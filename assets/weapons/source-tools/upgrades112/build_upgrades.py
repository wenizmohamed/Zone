"""Bounded visual-only CC0 sniper derivatives, using the proven v111 tools.

Never imports a .blend script, modifies a source, or writes runtime bindings.
Run Blender 4.5.9 with --background --factory-startup --disable-autoexec.
"""
import ast
import bpy
import bmesh
import math
import json
import hashlib
import numpy as np
import sys
from pathlib import Path
from mathutils import Vector, Matrix

WEAPONS = Path(__file__).resolve().parents[2]
ROOT = WEAPONS.parents[1]
OUT = WEAPONS / 'upgrades112'
REVIEW = ROOT / '.tools' / 'v112-weapons'
OUT.mkdir(exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
TEMPLATE = WEAPONS / 'source-tools' / 'upgrades111' / 'build_upgrades.py'
# Reuse only the audited helpers, never the old production loop. No v111 file
# is rewritten. The source hash is recorded in the new receipt.
helpers = {'sha', 'bevel', 'uv', 'image', 'surface', 'plain', 'block', 'cylinder', 'mesh_bounds', 'render'}
class Revision(ast.NodeTransformer):
    def visit_Constant(self, node):
        if isinstance(node.value, str):
            node.value = node.value.replace('111', '112')
        return node
    def visit_Expr(self, node):
        if isinstance(node.value,ast.Call) and ast.unparse(node.value.func)=='bpy.ops.render.render':
            return [ast.Expr(value=ast.Call(func=ast.Name(id='capture_render',ctx=ast.Load()),args=[ast.Name(id=name,ctx=ast.Load()) for name in ['path','frame','size','transparent']],keywords=[])),node]
        return self.generic_visit(node)
module = ast.parse(TEMPLATE.read_text(encoding='utf-8'))
module.body = [Revision().visit(node) for node in module.body if isinstance(node, ast.FunctionDef) and node.name in helpers]
exec(compile(ast.fix_missing_locations(module), str(TEMPLATE), 'exec'))

def capture_render(path, frame, size, transparent):
    bpy.context.view_layer.update()
    scene=bpy.context.scene
    camera=scene.camera
    evidence={'cameraMatrix':list(camera.matrix_world), 'lens':camera.data.lens,'sensorFit':camera.data.sensor_fit,
        'sensorHeight':camera.data.sensor_height,'resolution':list(size),'transparent':transparent,
        'frame':{'min':list(frame[0]),'max':list(frame[1])},'viewTransform':scene.view_settings.view_transform,
        'lights':[{'location':list(o.location),'rotation':list(o.rotation_euler),'energy':o.data.energy,'size':o.data.size} for o in scene.objects if o.type=='LIGHT'],
        'worldColor':list(scene.world.node_tree.nodes['Background'].inputs['Color'].default_value),
        'worldStrength':scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value,
        'renderer':'CPU Cycles, exported-GLB asset evidence, not WebGL browser capture'}
    evidence['cameraMatrix']=[list(row) for row in evidence['cameraMatrix']]
    (REVIEW/(Path(path).stem+'.camera.json')).write_text(json.dumps(evidence,indent=2),encoding='utf-8')

SOURCES = {
    'dragunov': {'id':'tabasco-dragunov', 'file':'tabasco-dragunov.glb', 'scale':.12,
        'grip':[-3,-.55,-4.84499526024], 'blenderGrip':[-3,4.84499526024,-.55]},
    'mosin9130': {'id':'tabasco-mosin9130', 'file':'tabasco-mosin9130.glb', 'scale':.125,
        'grip':[-2.5,0,.00015943159], 'blenderGrip':[-2.5,-.00015943159,0]}
}

def source_mesh(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    spec = SOURCES[kind]
    bpy.ops.import_scene.gltf(filepath=str(WEAPONS / 'premium' / 'v99' / spec['file']))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(objects) == 1, 'Retained source topology changed; remeasure before adapting.'
    obj = objects[0]
    transform = Matrix.Scale(spec['scale'],4) @ Matrix.Translation(-Vector(spec['blenderGrip'])) @ Matrix.Rotation(-math.pi/2,4,'Z') @ obj.matrix_world
    obj.data.transform(transform)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    bpy.context.view_layer.update()
    return obj

def inspect(kind):
    obj = source_mesh(kind)
    print('SOURCE',kind,len(obj.data.vertices),len(obj.data.polygons))
    for i, material in enumerate(obj.data.materials):
        points = [obj.data.vertices[v].co for p in obj.data.polygons if p.material_index == i for v in p.vertices]
        print('MATERIAL',i,material.name, 'bounds', [round(min(p[j] for p in points),5) for j in range(3)], [round(max(p[j] for p in points),5) for j in range(3)])
    bm = bmesh.new(); bm.from_mesh(obj.data)
    remaining = set(bm.verts)
    while remaining:
        todo, island = [remaining.pop()], []
        while todo:
            v = todo.pop(); island.append(v)
            for edge in v.link_edges:
                other = edge.other_vert(v)
                if other in remaining:
                    remaining.remove(other); todo.append(other)
        if len(island) > 10:
            print('ISLAND',len(island),'bounds',[round(min(v.co[j] for v in island),5) for j in range(3)], [round(max(v.co[j] for v in island),5) for j in range(3)])
    bm.free()
    render(REVIEW/(kind+'-source-inspection.png'),mesh_bounds())

if '--inspect' in sys.argv:
    for kind in SOURCES:
        inspect(kind)
    raise SystemExit(0)

def walnut(source_material, seed):
    """Retained CC0 wood color/normal, plus original nonmetallic roughness.

    Preserve the richer original atlas and projected UVs. No generic stripe
    texture replaces the source. The old shader factor is copied exactly.
    """
    material=source_material.copy()
    material.name='ZONE112_retained_CC0_worn_walnut'
    nodes,links=material.node_tree.nodes,material.node_tree.links
    shader=next(node for node in nodes if node.type=='BSDF_PRINCIPLED')
    for node in nodes:
        if node.type=='TEX_IMAGE':
            original=node.image
            # Lossless PNG repack of the decoded retained color/normal pixels,
            # not a texture redesign. CPU tests can decode every shipped map.
            name='LonesomeDucky_CC0_Wood_Normal' if original.colorspace_settings.name=='Non-Color' else 'LonesomeDucky_CC0_Wood_BaseColor'
            pixels=np.empty(len(original.pixels),dtype=np.float32);original.pixels.foreach_get(pixels)
            decoded=bpy.data.images.new(name,width=original.size[0],height=original.size[1],alpha=False)
            decoded.colorspace_settings.name=original.colorspace_settings.name
            decoded.pixels.foreach_set(pixels);decoded.pack();node.image=decoded
            print('WOOD_IMAGE',decoded.name,list(decoded.size),decoded.file_format)
    shader.inputs['Metallic'].default_value=0
    rng = np.random.default_rng(seed)
    n = 512
    yy, xx = np.mgrid[:n, :n]
    fine = rng.random((n,n))
    # Atlas V follows the weapon's long axis. Fine directional roughness
    # variation augments the retained pores without broad artificial stripes.
    fibers=np.sin(xx*.73+np.sin(yy*.019)*4)
    orm=np.ones((n,n,4));orm[:,:,1]=np.clip(.67+(fine-.5)*.12+fibers*.035,.49,.82);orm[:,:,2]=0
    tex=nodes.new('ShaderNodeTexImage');tex.image=image('ZONE112_walnut_roughness_orm',orm,False);tex.extension='REPEAT'
    separate=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],separate.inputs['Color'])
    links.new(separate.outputs['Green'],shader.inputs['Roughness']);links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
    return material

def furniture_uv(obj, wood_index):
    # Side-view grain follows the actual long axis, never grain stretching in a
    # generic cube atlas. Other material regions retain the v111 cube UVs.
    layer=obj.data.uv_layers.active
    for polygon in obj.data.polygons:
        if polygon.material_index!=wood_index: continue
        for loop_index in polygon.loop_indices:
            co=obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            layer.data[loop_index].uv=(co.x*1.5+.5,co.z*5+.5) if abs(polygon.normal.y)>.45 else (co.x*1.5+.5,co.y*5+.5)

def ring(name, x, y, z, radius, width, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=6, location=(x,y,z),
        rotation=(0,math.pi/2,0),major_radius=radius-width/2,minor_radius=width/2)
    obj=bpy.context.object; obj.name=name; obj.data.materials.append(mat)
    for polygon in obj.data.polygons: polygon.use_smooth=True
    uv(obj)
    return obj

def materials(source_wood,seed):
    return {
        'wood':walnut(source_wood,seed),
        'steel':surface('worn_blued_steel',(.125,.142,.157),.88,.47,seed+1),
        'rubber':surface('matte_optic_rubber',(.025,.030,.033),0,.84,seed+2,True),
        'edge':plain('worn_fasteners',(.26,.28,.30),.91,.34),
        'recess':plain('recessed_mechanical_insets',(.015,.021,.025),.42,.62),
        'optic':plain('anodized_optic_housing',(.046,.057,.062),.16,.67),
        # Opaque coated-glass approximation avoids transparency sorting and
        # extra per-frame passes; no fake through-scope functionality is claimed.
        'lens':plain('coated_optic_lens',(.035,.066,.073),.15,.13)
    }

def adapt(kind):
    obj=source_mesh(kind)
    source_vertices=len(obj.data.vertices)
    source_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    old=[m.name for m in obj.data.materials]
    regions=[p.material_index for p in obj.data.polygons]
    source_wood=next(m for m in obj.data.materials if 'walnut' in m.name)
    mat=materials(source_wood,1121 if kind=='dragunov' else 1122)
    obj.name='Tabasco_'+kind+'_retained_base_chamfered112'
    obj.data.materials.clear()
    for material in [mat['steel'],mat['wood'],mat['rubber'],mat['optic']]: obj.data.materials.append(material)
    for p,region in zip(obj.data.polygons,regions):
        p.material_index=1 if 'walnut' in old[region] else 0
        if kind=='dragunov' and region==4: p.material_index=2
        if kind=='dragunov' and region in [2,3]: p.material_index=3
    bevel(obj,.00085,3)
    # Bevel interpolation preserves the original wood projection. Generate
    # new steel UVs, restoring actual retained atlas UVs on wooden polygons.
    old_uv={loop:tuple(obj.data.uv_layers.active.data[loop].uv) for p in obj.data.polygons if p.material_index==1 for loop in p.loop_indices}
    uv(obj)
    for loop,value in old_uv.items(): obj.data.uv_layers.active.data[loop].uv=value
    base_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    if kind=='dragunov':
        for side in [-1,1]:
            # Thin connected panels hug the measured source receiver; no
            # floating ornaments or offset whole-weapon alignment changes.
            block('SVD receiver reinforcing panel',(.146,side*.0144-.00065,.072),(.27,.0018,.037),mat['steel'],.0012)
            for z in [.093,.102]: block('SVD receiver upper seam',(.149,side*.0149-.00065,z),(.283,.0018,.0024),mat['edge'],.0005)
            for x,z in [(.025,.057),(.278,.058),(.064,.086)]:
                cylinder('SVD retained fastener',(x,side*.0163-.00065,z),.0031,.0015,mat['edge'])
                block('SVD slotted fastener inset',(x,side*.0172-.00065,z),(.0038,.0005,.0007),mat['recess'],.0001)
            for i in range(6):
                block('SVD handguard ventilation recess',(.335+i*.039,side*.0188-.00065,.091),(.022,.0014,.006),mat['recess'],.0018)
            for i in range(3):
                block('SVD pressed magazine channel',(.189+i*.026,side*.0132-.00065,.003),(.006,.0015,.076),mat['recess'],.0014)
            for x,z in [(-.204,.002),(-.026,.027),(.323,.061),(.551,.061)]:
                hit,point,normal,index=obj.ray_cast(Vector((x,side*.2,z)),Vector((0,-side,0)))
                if hit:
                    cylinder('SVD wood furniture screw',(x,point.y+side*.0005,z),.0027,.0015,mat['edge'],vertices=16)
            # Checkering at the existing wooden pistol grip, above the socket
            # centerline to preserve its real bilateral hand section.
            for i in range(7):
                block('SVD grip checkering',(.032,side*.0117-.00065,.018+i*.0038),(.019,.0007,.0007),mat['recess'],.0001,.36)
        block('SVD right ejection inset',(.184,-.0166,.079),(.079,.0016,.023),mat['recess'],.0018)
        block('SVD bolt face in ejection inset',(.192,-.0176,.080),(.049,.0006,.014),mat['steel'],.0008)
        block('SVD safety lever',(.054,-.0172,.059),(.035,.0026,.004),mat['steel'],.0006,-.28)
        # Preserve the author optic body, add rings, mount clamps, lens discs
        # and low-profile turrets. This is visual mesh detail only.
        for x,radius in [(-.046,.025),(-.036,.025),(.041,.0195),(.225,.0205),(.267,.0225)]:
            ring('SVD optic machined collar',x,-.00065,.143,radius,.0022,mat['steel'])
        cylinder('SVD optic ocular coated surface',(-.0534,-.00065,.143),.0205,.0008,mat['lens'],'X',32)
        cylinder('SVD optic objective coated surface',(.2763,-.00065,.143),.0166,.0008,mat['lens'],'X',32)
        for x in [.062,.214]:
            block('SVD scope mount foot',(x,-.00065,.114),(.026,.035,.013),mat['steel'],.001)
            for side in [-1,1]: cylinder('SVD scope clamp screw',(x,side*.018-.00065,.115),.0031,.002,mat['edge'])
        cylinder('SVD elevation control',(.139,-.00065,.168),.010,.009,mat['steel'],'Z',24)
        ring('SVD ocular rubber rim',-.049,-.00065,.143,.026,.003,mat['rubber'])
        for i in range(12):
            a=i*math.tau/12
            block('SVD turret edge knurl',(.139+math.cos(a)*.0092,-.00065+math.sin(a)*.0092,.173),(.0015,.0015,.004),mat['edge'],.0003)
    else:
        for side in [-1,1]:
            block('Mosin receiver side plate',(.113,side*.011+.00002,.060),(.142,.0015,.012),mat['steel'],.0009)
            for x in [.049,.169]:
                cylinder('Mosin receiver hardware',(x,side*.0123+.00002,.059),.0024,.0015,mat['edge'],vertices=16)
            for x,z,y in [(-.285,-.024,.018),(.219,.032,.016),(.415,.044,.0125),(.744,.044,.0125)]:
                cylinder('Mosin wood and band fastener',(x,side*y,z),.0027,.0015,mat['edge'],vertices=16)
                block('Mosin screw inset',(x,side*(y+.001),z),(.0035,.0005,.0007),mat['recess'],.0001)
            block('Mosin stock shoulder reinforcing seam',(-.286,side*.019,-.024),(.002,.0012,.078),mat['steel'],.0004,.15)
        # Readable bolt housing edge and period iron-sight leaf, rather than
        # adding an unrequested scope to the Mosin source configuration.
        block('Mosin bolt raceway',(.111,-.0113,.071),(.133,.0017,.007),mat['recess'],.0007)
        block('Mosin bolt polished runner',(.120,-.0124,.0715),(.094,.0006,.003),mat['edge'],.0004)
        for x in [.027,.174]: ring('Mosin receiver ring',x,.00002,.063,.0126,.0015,mat['steel'])
        cylinder('Mosin bolt knob collar',(.110,-.024,.065),.0056,.004,mat['edge'],'Y',24)
        block('Mosin rear sight leaf',(.322,0,.081),(.062,.011,.0028),mat['steel'],.0006)
        for i in range(6): block('Mosin sight leaf graduation',(.298+i*.009,0,.0827),(.0008,.008,.0006),mat['edge'],.0001)
        # Metal bands follow the existing stock; each uses separate highlight
        # and pin geometry, rather than just painting a line on the old mesh.
        for x in [.402,.742]:
            for side in [-1,1]: block('Mosin fore-end band plate',(x,side*.0129,.053),(.008,.0019,.041),mat['steel'],.0007)
            block('Mosin band upper lip',(x,0,.0765),(.008,.025,.0015),mat['edge'],.0004)
        # Endgrain is represented by the shared original wood surface UVs;
        # retain the curved author stock, no replacement box stock.
    return obj, source_vertices, source_triangles, base_triangles

records=[]
for kind in SOURCES:
    source_mesh(kind)
    before_frame=mesh_bounds()
    obj,vertices,source_triangles,base_triangles=adapt(kind)
    after_frame=mesh_bounds()
    pair=(Vector([min(before_frame[0][i],after_frame[0][i]) for i in range(3)]),Vector([max(before_frame[1][i],after_frame[1][i]) for i in range(3)]))
    detail=(Vector((-.12,-.08,-.055)),Vector((.37,.08,.20))) if kind=='dragunov' else (Vector((-.05,-.08,-.04)),Vector((.43,.08,.14)))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    detail_parts=[{'name':o.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in objects if o!=obj]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.join()
    obj['zoneVisualUpgrade']=112; obj['nonfunctionalGameArt']=True
    obj['retainedSource']=SOURCES[kind]['id']
    obj['detailPartCount']=len(detail_parts)
    path=OUT/(kind+'-detail112.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO')
    # Render the exported GLB re-import, never only the pre-export Blender
    # scene. This catches missing material slots, UVs and export conversion.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    render(REVIEW/(kind+'-after.png'),pair)
    render(REVIEW/(kind+'-detail-after.png'),detail)
    render(OUT/(kind+'-thumbnail.png'),pair,(384,280),True)
    data=path.read_bytes(); gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    record={'id':kind+'-detail112','path':'assets/weapons/upgrades112/'+path.name,'sha256':sha(path),'bytes':len(data),
        'triangles':triangles,'primitives':sum(len(m['primitives']) for m in gltf['meshes']),'images':len(gltf.get('images',[])),
        'originalSourceId':SOURCES[kind]['id'],'originalPath':'assets/weapons/premium/v99/'+SOURCES[kind]['file'],
        'sourceVertices':vertices,'sourceTriangles':source_triangles,'baseChamferTriangles':base_triangles,
        'addedDetailTriangles':sum(p['triangles'] for p in detail_parts),'detailParts':detail_parts,
        'physicalBoundsBlender':{'min':list(after_frame[0]),'max':list(after_frame[1])},
        'reviewFrame':{'min':list(pair[0]),'max':list(pair[1])},'detailReviewFrame':{'min':list(detail[0]),'max':list(detail[1])},
        'thumbnail':kind+'-thumbnail.png','thumbnailRenderedFromExportedGLB':True}
    records.append(record)
    source_mesh(kind)
    render(REVIEW/(kind+'-before.png'),pair)
    render(REVIEW/(kind+'-detail-before.png'),detail)
    print('ZONE112_RECORD',json.dumps({k:v for k,v in record.items() if k!='detailParts'}))
(REVIEW/'build-receipt.json').write_text(json.dumps({'revision':112,'renderer':'Blender 4.5.9 CPU Cycles; exported-GLB asset evidence, not browser proof',
    'template':str(TEMPLATE.relative_to(ROOT)).replace('\\','/'),'templateSha256':sha(TEMPLATE),'assets':records},indent=2),encoding='utf-8')
