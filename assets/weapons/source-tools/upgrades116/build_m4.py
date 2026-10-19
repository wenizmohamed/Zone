"""M4 derivative116. Original licensed geometry/UVs remain the visual foundation.

Portable Blender 4.5.9, --background --factory-startup --disable-autoexec.
All additions are nonfunctional game-art meshes, not firearm production plans.
Only this derivative directory and the private evidence directory are written.
"""
import ast
import bpy
import math
import json
import hashlib
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[4]
WEAPONS=ROOT/'assets/weapons'
OUT=WEAPONS/'upgrades116'
REVIEW=ROOT/'.tools/beta116-media'
REVIEW.mkdir(parents=True,exist_ok=True)
OUT.mkdir(exist_ok=True)
SOURCE=WEAPONS/'library/models/cc0-guns-explosives-pack-glb--m4a1.glb'
TEMPLATE=WEAPONS/'source-tools/upgrades111/build_upgrades.py'

class Revision(ast.NodeTransformer):
    def visit_Constant(self,node):
        if isinstance(node.value,str):node.value=node.value.replace('111','116')
        if node.value==512:node.value=256
        return node
    def visit_Expr(self,node):
        if isinstance(node.value,ast.Call) and ast.unparse(node.value.func)=='bpy.ops.render.render':
            capture=ast.Expr(value=ast.Call(func=ast.Name(id='capture_render',ctx=ast.Load()),args=[ast.Name(id=n,ctx=ast.Load()) for n in ['path','frame','size','transparent']],keywords=[]))
            return [capture,node]
        return self.generic_visit(node)
helpers={'sha','bevel','uv','image','surface','plain','block','cylinder','mesh_bounds','render'}
module=ast.parse(TEMPLATE.read_text(encoding='utf-8'))
module.body=[Revision().visit(n) for n in module.body if isinstance(n,ast.FunctionDef) and n.name in helpers]
exec(compile(ast.fix_missing_locations(module),str(TEMPLATE),'exec'))

def capture_render(path,frame,size,transparent):
    bpy.context.view_layer.update()
    scene=bpy.context.scene
    evidence={'cameraMatrix':[list(row) for row in scene.camera.matrix_world],
        'resolution':list(size),'transparent':transparent,'frame':{'min':list(frame[0]),'max':list(frame[1])},
        'lens':scene.camera.data.lens,'sensorFit':scene.camera.data.sensor_fit,'sensorHeight':scene.camera.data.sensor_height,
        'viewTransform':scene.view_settings.view_transform,
        'lights':[{'location':list(o.location),'rotation':list(o.rotation_euler),'energy':o.data.energy,'size':o.data.size} for o in scene.objects if o.type=='LIGHT'],
        'worldColor':list(scene.world.node_tree.nodes['Background'].inputs['Color'].default_value),
        'worldStrength':scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value,
        'renderer':'CPU Cycles, exact exported GLB. Not a browser capture.'}
    (REVIEW/(Path(path).stem+'.camera.json')).write_text(json.dumps(evidence,indent=2),encoding='utf-8')

def source_mesh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    # Blender Z-up form of normalizeWeaponAsset's measured Three.js grip and
    # -PI/2 Y orientation. No category/pose/camera/grip correction is hidden.
    transform=Matrix.Translation(Vector((.071,-.000765,.072)))@Matrix.Rotation(-math.pi/2,4,'Z')
    for obj in objects:
        obj.data.transform(transform@obj.matrix_world);obj.matrix_world=Matrix.Identity(4);obj.data.update()
    bpy.context.view_layer.update()
    return objects

def detailed():
    originals=source_mesh()
    base_triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in originals)
    original_frame=mesh_bounds()
    # The source already has authored hard edges and UV-split thin sheets.
    # Beveling those indiscriminately creates bright slivers. Keep every source
    # triangle untouched, and spend added chamfers on the fitted new hardware.
    source_material=originals[0].data.materials[0]
    atlas=next(n for n in source_material.node_tree.nodes if n.type=='TEX_IMAGE' and 'Base_Color' in n.image.name)
    source_pixels=np.array(atlas.image.pixels[:],dtype=np.float32).reshape(atlas.image.size[1],atlas.image.size[0],4)
    readable=source_pixels.copy()
    readable[:,:,:3]=np.clip(source_pixels[:,:,:3]*1.65+.016,0,1)
    def mobile_map(pixels):
        assert pixels.shape[:2]==(1024,1024),'remeasure changed source atlas'
        return pixels.reshape(512,2,512,2,4).mean(axis=(1,3))
    readable_atlas=image('ZONE116_retained_CC0_atlas_readability',mobile_map(readable),True)
    atlas.image=readable_atlas
    for node in [n for n in source_material.node_tree.nodes if n.type=='TEX_IMAGE' and n != atlas]:
        retained=node.image
        pixels=np.array(retained.pixels[:],dtype=np.float32).reshape(retained.size[1],retained.size[0],4)
        node.image=image('ZONE116_retained_CC0_'+retained.name,mobile_map(pixels),False)
    source_material.name='ZONE116_retained_CC0_atlas_readable_steel'
    # Retain the original normal/roughness/metal maps, not a fake claim of new
    # author maps. The source atlas's mottle/edge wear survives the value lift.
    chamfer_triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in originals)
    kit={
        'metal':surface('satin_anodized_receiver',(.095,.115,.131),.82,.43,116),
        'polymer':surface('graphite_textured_rail_cover',(.052,.063,.070),.015,.76,117,True),
        'rubber':surface('matte_buttpad',(.018,.023,.026),0,.90,118,True),
        'edge':plain('brushed_control_edges',(.23,.25,.26),.88,.34),
        'recess':plain('recessed_hardware',(.012,.017,.021),.35,.66),
    }
    for side in [-1,1]:
        # Small fitted panel surfaces reinforce the original receiver rather
        # than replacing its much more complex authored silhouette.
        block('116 receiver lower fitted side plate',(.023,side*.0149,.065),(.109,.0016,.027),kit['metal'],.001)
        block('116 receiver upper edge seam',(.050,side*.0148,.109),(.192,.0014,.0022),kit['edge'],.00035)
        for x,z in [(-.020,.064),(.068,.059),(.158,.070)]:
            cylinder('116 captive pin collar',(x,side*.0156,z),.0032,.0022,kit['metal'],vertices=16)
            cylinder('116 captive pin inset',(x,side*.01685,z),.0015,.0004,kit['recess'],vertices=12)
        # Bounded individual rail teeth, chamfered edges and shallow fastening
        # recesses read as separate hardware, not painted black rectangles.
        block('116 handguard longitudinal rail',(.279,side*.0215,.092),(.173,.0034,.015),kit['metal'],.001)
        for i in range(11):
            x=.199+i*.0155
            block('116 fitted rail tooth',(x,side*.024,.092),(.0063,.003,.022),kit['metal'],.0006)
        for i in range(3):
            x=.218+i*.054
            block('116 rail cover inset',(x,side*.0253,.091),(.034,.0021,.013),kit['polymer'],.0011)
            for j in range(4):
                block('116 rail cover raised tread',(x-.012+j*.0078,side*.0266,.091),(.0022,.001,.010),kit['rubber'],.00035)
        for x in [.194,.363]:
            cylinder('116 rail mounting fastener',(x,side*.026,.093),.0026,.0009,kit['edge'],vertices=16)
            block('116 fastener recess',(x,side*.0266,.093),(.0025,.0004,.0006),kit['recess'],.0001)
        # Preserve the stock cut-out and original dimensions. Only shallow
        # cheek-contact panels and rubber contact strips are added.
        block('116 stock cheek-contact strip',(-.164,side*.0159,.096),(.101,.0011,.004),kit['polymer'],.0011)
        for i in range(6):
            z=-.012+i*.019
            block('116 stock buttpad tread',(-.244+z*.13,side*.0152,z),(.004,.0012,.0026),kit['rubber'],.00055)
        # Magazine stamping remains within its original curved envelope.
        for i in range(3):
            x=.114+i*.014
            block('116 magazine recessed channel',(x,side*.0109,-.010),(.0032,.0012,.089),kit['recess'],.001,-.11)
        for i in range(6):
            block('116 pistol-grip side tread',(-.018,side*.0117,-.013-i*.006),(.024,.0012,.0018),kit['rubber'],.0004,-.29)
    # Readable ejection-side and receiver controls, without covering the
    # author's actual opening, selector, trigger, sights or charging handle.
    block('116 ejection cover shallow emboss',(.113,-.0248,.075),(.065,.0008,.007),kit['metal'],.001)
    cylinder('116 selector hub',(.009,.0140,.054),.0042,.0026,kit['edge'],vertices=20)
    block('116 selector lever face',(.009,.0157,.046),(.006,.0014,.016),kit['metal'],.001,-.28)
    block('116 magazine floorplate',(.142,0,-.099),(.059,.020,.003),kit['metal'],.0008)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    additions=[o for o in objects if o not in originals]
    detail_triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in additions)
    new_frame=mesh_bounds()
    frame=(Vector([min(original_frame[0][i],new_frame[0][i]) for i in range(3)]),Vector([max(original_frame[1][i],new_frame[1][i]) for i in range(3)]))
    for obj in objects:obj['zoneVisualUpgrade']=116;obj['nonfunctionalGameArt']=True
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=originals[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name='ZONE116_M4_licensed_source_with_authored_detail'
    path=OUT/'m4-detail116.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO')
    data=path.read_bytes();gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
    return {'id':'m4-detail116','path':'assets/weapons/upgrades116/'+path.name,'bytes':len(data),'sha256':sha(path),
        'sourceTriangles':base_triangles,'chamferedSourceTriangles':chamfer_triangles,'addedDetailTriangles':detail_triangles,
        'triangles':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),
        'primitives':sum(len(m['primitives']) for m in gltf['meshes']),'images':len(gltf.get('images',[])),
        'boundsBlender':{'min':list(new_frame[0]),'max':list(new_frame[1])},'frame':{'min':list(frame[0]),'max':list(frame[1])},
        'descriptor':{'scale':1,'grip':[0,0,0],'rotation':[0,0,0],'axis':-1,'forward':True},'thumbnail':'/assets/weapons/upgrades116/m4-thumbnail.png'}

record=detailed()
frame=(Vector(record['frame']['min']),Vector(record['frame']['max']))
# Match before/after cameras and lights, and render the exported/reimported GLB
# rather than an authoring-only Blender material setup.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'m4-detail116.glb'))
render(REVIEW/'m4-after.png',frame)
render(OUT/'m4-thumbnail.png',frame,(384,280),True)
record['thumbnailSha256']=sha(OUT/'m4-thumbnail.png')
record['thumbnailBytes']=(OUT/'m4-thumbnail.png').stat().st_size
source_mesh();render(REVIEW/'m4-before.png',frame)
render(REVIEW/'m4-before-thumbnail.png',frame,(384,280),True)
receipt={'revision':116,'renderer':'Blender 4.5.9 CPU Cycles, exact exported GLB. Not a browser capture.',
    'templateSha256':sha(TEMPLATE),'sourceToolSha256':sha(Path(__file__)),
    'source':{'path':str(SOURCE.relative_to(ROOT)).replace('\\','/'),'bytes':SOURCE.stat().st_size,'sha256':sha(SOURCE)},'assets':[record]}
(REVIEW/'build-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print('ZONE116_RECORD',json.dumps(record))
