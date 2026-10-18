"""Reproducible visual-only CC0 derivatives. No gameplay or original asset writes.

Run in Blender 4.5 LTS with --background --factory-startup --disable-autoexec.
The procedural maps are deterministic original surface work, not author photos.
Only ready GLB and PNG thumbnail exports go into the public upgrades111 folder.
"""
import bpy
import math
import json
import hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

WEAPONS = Path(__file__).resolve().parents[2]
ROOT = WEAPONS.parents[1]
OUT = WEAPONS / 'upgrades111'
REVIEW = ROOT / '.tools' / 'v111-weapons'
OUT.mkdir(exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bevel(obj, width=.001, segments=3):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('111 physical edge chamfers', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = width, segments, 'ANGLE'
    mod.angle_limit = math.radians(28)
    mod.affect = 'EDGES'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    normals = obj.modifiers.new('111 weighted hard-surface normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp, normals.weight = True, 50
    bpy.ops.object.modifier_apply(modifier=normals.name)


def uv(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=.12, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def image(name, pixels, color=True):
    height, width, _ = pixels.shape
    result = bpy.data.images.new(name, width=width, height=height, alpha=False)
    result.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    result.pixels.foreach_set(pixels.astype(np.float32).ravel())
    result.pack()
    return result


def surface(name, color, metal, roughness, seed, polymer=False):
    """512px base-color, packed ORM and tangent-normal maps, bounded and tiled."""
    material = bpy.data.materials.new('ZONE111_' + name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    rng = np.random.default_rng(seed)
    n = 512
    yy, xx = np.mgrid[:n, :n]
    grain = rng.random((n, n))
    long_grain = rng.random((n, 1))
    scratches = np.clip((np.sin(xx * .31 + np.sin(yy*.02)) - .985) * 28, 0, 1)
    scratches *= np.clip((np.sin(yy*.041 + xx*.009) - .15) * 2, 0, 1)
    if polymer:
        height = grain * .06 + np.sin(xx*.67)*np.sin(yy*.67)*.035
        value = .80 + grain*.36 + long_grain*.08
        scratch_scale = .035
    else:
        height = grain*.013 + long_grain*.015 + scratches*.025
        value = .82 + grain*.16 + long_grain*.08 + scratches*.35
        scratch_scale = .12
    albedo = np.ones((n, n, 4))
    # Image pixels tagged sRGB are encoded sRGB, not linear shader factors.
    # Convert the intended physical reflectance; normals and ORM stay non-color.
    for channel in range(3):
        linear = np.clip(color[channel]*value + scratches*scratch_scale, 0, 1)
        albedo[:, :, channel] = np.where(linear <= .0031308, linear*12.92, 1.055*np.power(linear,1/2.4)-.055)
    orm = np.ones((n, n, 4))
    orm[:, :, 1] = np.clip(roughness + (grain-.5)*.12 - scratches*.15, .12, .96)
    orm[:, :, 2] = metal
    dy, dx = np.gradient(height)
    nx, ny = -dx * 2, -dy * 2
    nz = np.ones_like(nx)
    length = np.sqrt(nx*nx+ny*ny+nz*nz)
    normal = np.ones((n, n, 4))
    normal[:, :, 0] = nx/length*.5+.5
    normal[:, :, 1] = ny/length*.5+.5
    normal[:, :, 2] = nz/length*.5+.5
    for suffix, pixels, is_color in [('basecolor', albedo, True), ('orm', orm, False), ('normal', normal, False)]:
        tex = nodes.new('ShaderNodeTexImage')
        tex.name = 'ZONE111_' + name + '_' + suffix
        tex.image = image(tex.name, pixels, is_color)
        tex.extension = 'REPEAT'
        if suffix == 'basecolor':
            links.new(tex.outputs['Color'], shader.inputs['Base Color'])
        elif suffix == 'orm':
            separate = nodes.new('ShaderNodeSeparateColor')
            links.new(tex.outputs['Color'], separate.inputs['Color'])
            links.new(separate.outputs['Green'], shader.inputs['Roughness'])
            links.new(separate.outputs['Blue'], shader.inputs['Metallic'])
        else:
            normal_node = nodes.new('ShaderNodeNormalMap')
            normal_node.inputs['Strength'].default_value = .35 if polymer else .22
            links.new(tex.outputs['Color'], normal_node.inputs['Color'])
            links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])
    return material


def plain(name, color, metal=.75, roughness=.4):
    material = bpy.data.materials.new('ZONE111_' + name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = roughness
    return material


def block(name, center, size, material, radius=.0008, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    obj.rotation_euler.y = angle
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel(obj, radius)
    uv(obj)
    return obj


def cylinder(name, center, radius, depth, material, axis='Y', vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (math.pi/2, 0, 0) if axis == 'Y' else (0, math.pi/2, 0) if axis == 'X' else (0, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel(obj, min(radius*.14, .00045), 2)
    uv(obj)
    return obj


def import_original(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = WEAPONS / 'premium' / 'v99' / ('tabasco-' + kind + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(path))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    scale = {'g3a3':.1, 'l85':.081, 'm1911':.023}[kind]
    grip = {'g3a3':(-2,0,-.6), 'l85':(-.5,3.8161939442,-.8), 'm1911':(-3,-.46975868940,-1.5)}[kind]
    rot = -math.pi/2 if kind != 'm1911' else math.pi/2
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-Vector(grip)) @ Matrix.Rotation(rot, 4, 'Z') @ obj.matrix_world
    obj.data.transform(transform)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    bpy.context.view_layer.update()
    return obj


def import_glock():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=str(REVIEW / 'Glock_HighPoly.obj'))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    # Original OBJ local coordinates: muzzle -X, upper slide -Z. A rigid half
    # turn gives canonical muzzle +X. This is an art transform, not a weapon spec.
    scale = .025
    grip = Vector((-3.05, -.247, -.65))
    obj.data.transform(Matrix.Scale(scale, 4) @ Matrix.Translation(-grip) @ Matrix.Rotation(math.pi, 4, 'Y'))
    obj.matrix_world = Matrix.Identity(4)
    obj.name = 'Locarem_Glock18_authored_receiver_frame_controls'
    obj.data.update()
    bpy.context.view_layer.update()
    return obj


def materials(seed, green=True):
    return {
        'steel': surface('worn_parkerized_steel', (.125,.142,.157), .88, .47, seed),
        'polymer': surface('olive_fiberglass' if green else 'stippled_graphite', (.115,.125,.078) if green else (.052,.059,.062), .015, .79, seed+1, True),
        'rubber': surface('rubber_buttpad', (.023,.027,.029), 0, .9, seed+2, True),
        'bright': plain('worn_edge_fasteners', (.28,.30,.32), .91, .3),
        'recess': plain('machined_recesses', (.013,.017,.020), .45, .62),
    }


def rifles(kind):
    obj = import_original(kind)
    obj.name = 'Tabasco_' + kind + '_retained_silhouette_bevelled111'
    mat = materials(111 if kind == 'g3a3' else 112)
    old = [slot.material.name for slot in obj.material_slots]
    original_regions = [p.material_index for p in obj.data.polygons]
    obj.data.materials.clear()
    for material in [mat['steel'], mat['polymer'], mat['rubber']]:
        obj.data.materials.append(material)
    for p, region in zip(obj.data.polygons, original_regions):
        p.material_index = 1 if 'polymer' in old[region] else 0
        c = p.center
        if kind == 'g3a3' and -.07 < c.x < .06 and c.z < .052:
            p.material_index = 1
    bevel(obj, .0012)
    uv(obj)
    if kind == 'g3a3':
        for side in [-1,1]:
            y = side*.0208
            block('G3 receiver stamped side wall ' + str(side), (.067,y,.104), (.292,.0022,.034), mat['steel'])
            for z in [.130,.141]:
                block('G3 stamped reinforcing rib', (.068,y,z), (.285,.0025,.0027), mat['bright'], .0006)
            for x,z in [(-.056,.079),(.183,.076),(-.035,.119)]:
                cylinder('G3 receiver retained pin', (x,side*.0222,z), .0034, .0018, mat['bright'])
                block('G3 pin slot', (x,side*.0233,z), (.0038,.0005,.00065), mat['recess'], .00012)
            for i in range(8):
                x = .26 + i*.031
                block('G3 handguard recessed vent', (x,side*.0224,.121), (.019,.0015,.005), mat['recess'], .0018)
            for i in range(3):
                x = .157 + i*.022
                block('G3 magazine pressed channel', (x,side*.0119,.025), (.005,.0015,.100), mat['recess'], .0015, -.04)
            for i in range(6):
                block('G3 buttpad tread', (-.278,side*.0163,.031+i*.015), (.010,.0012,.003), mat['rubber'], .0007)
        block('G3 ejection port well', (.129,-.0225,.108), (.071,.0016,.019), mat['recess'], .002)
        block('G3 ejection port bolt', (.124,-.0235,.108), (.050,.0006,.011), mat['steel'], .001)
        block('G3 charging tube seam', (.375,0,.144), (.29,.009,.003), mat['steel'], .001)
        block('G3 selector paddle', (-.038,-.024,.072), (.018,.003,.006), mat['steel'], .001, -.35)
        for i in range(8):
            block('G3 grip rib', (.013,-.0126,.016-i*.0052), (.028,.001,.0018), mat['rubber'], .0004, -.27)
    else:
        for side in [-1,1]:
            for z in [.053,.139]:
                block('L85 folded receiver seam', (-.113,side*.0217,z), (.365,.0020,.0032), mat['bright'], .0007)
            block('L85 receiver reinforcement panel', (-.185,side*.0219,.090), (.184,.002,.047), mat['steel'], .0017)
            for x,z in [(-.26,.060),(-.057,.062),(.060,.105)]:
                cylinder('L85 retained receiver fastener', (x,side*.0235,z), .0036, .0017, mat['bright'])
                block('L85 screw recess', (x,side*.0246,z), (.004,.0005,.0007), mat['recess'], .0001)
            for i in range(7):
                x = .12 + i*.028
                block('L85 handguard ventilation slot', (x,side*.0304,.112), (.014,.0018,.018), mat['recess'], .0024)
                block('L85 handguard raised rib', (x-.012,side*.0302,.090), (.004,.002,.026), mat['polymer'], .001)
            for i in range(3):
                block('L85 magazine stamped groove', (-.140+i*.024,side*.0149,-.002), (.005,.0017,.125), mat['recess'], .0014, -.08)
            for i in range(6):
                block('L85 textured buttpad rib', (-.329,side*.0220,.042+i*.017), (.014,.0016,.004), mat['rubber'], .001)
        block('L85 ejection port border', (-.192,-.024,.119), (.113,.0025,.023), mat['bright'], .0015)
        block('L85 ejection port recessed plate', (-.192,-.0256,.119), (.101,.001,.016), mat['recess'], .0013)
        block('L85 bolt surface', (-.173,-.0265,.119), (.058,.0007,.011), mat['steel'], .0008)
        block('L85 selector paddle', (-.030,-.0235,.073), (.017,.003,.005), mat['steel'], .001, -.4)
        for i in range(7):
            block('L85 grip surface rib', (.007,-.0147,.019-i*.006), (.026,.0013,.002), mat['rubber'], .0005, -.29)
    return obj


def pistol():
    obj = import_glock()
    mat = materials(113, False)
    original_regions = [p.material_index for p in obj.data.polygons]
    obj.data.materials.clear()
    for material in [mat['polymer'],mat['steel'],mat['bright'],mat['recess']]:
        obj.data.materials.append(material)
    for p, region in zip(obj.data.polygons, original_regions):
        # Original material regions 1/2/3 are slide, barrel/upper mechanism.
        # All six original surfaces are geometry, not a substituted old M1911.
        p.material_index = {0:0,1:1,2:1,3:2,4:0,5:3}[region]
    bevel(obj, .00025, 2)
    uv(obj)
    # The source already contains its slide serrations, sights, trigger and
    # controls. Add only a grip stipple panel and magazine-floor seam.
    for side in [-1,1]:
        panel = block('Glock grip stipple panel ' + str(side), (-.002,side*.0090,-.012), (.032,.0015,.043), mat['polymer'], .0025, -.20)
        cylinder('Glock grip panel index', (-.002,side*.0100,-.013), .0018, .0008, mat['recess'], vertices=16)
        for i in range(10):
            block('Glock rear slide serration', (-.030+i*.0024,side*.0098,.058), (.0010,.0012,.013), mat['recess'], .00025, -.15)
    return obj


def mesh_bounds():
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(p) for obj in bpy.context.scene.objects if obj.type == 'MESH' for p in obj.bound_box]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    return lo, hi


def render(path, frame, size=(1100,620), transparent=False):
    """CPU Cycles asset evidence. Same fixed frame for each before/after pair."""
    lo, hi = frame
    center = (lo+hi)/2
    span = max(hi-lo)
    scene = bpy.context.scene
    data = bpy.data.cameras.new('111 fixed asset review camera')
    camera = bpy.data.objects.new('111 fixed asset review camera', data)
    bpy.context.collection.objects.link(camera)
    direction = Vector((.65,-2.4,.32)).normalized()
    up = Vector((0,0,1))
    right = up.cross(direction).normalized()
    up = direction.cross(right).normalized()
    target = center - up*span*.045
    tan = math.tan(math.radians(38)/2)
    distance = span*.5
    for x in [lo.x,hi.x]:
        for y in [lo.y,hi.y]:
            for z in [lo.z,hi.z]:
                point = Vector((x,y,z))-target
                distance = max(distance, abs(point.dot(right))/(tan*(size[0]/size[1])*.84)+point.dot(direction), abs(point.dot(up))/(tan*.73)+point.dot(direction))
    camera.location = target+direction*distance*1.04
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.sensor_fit, data.sensor_height = 'VERTICAL', 24
    data.lens = 24/(2*math.tan(math.radians(38)/2))
    scene.camera = camera
    lights = []
    for offset,power,scale in [((-2,-2.5,3),140,2.0),((3,-1.5,1),55,2.0),((-1,2,2),180,1.5)]:
        light_data = bpy.data.lights.new('111 studio softbox', 'AREA')
        light_data.energy,light_data.shape,light_data.size = power*span*span,'DISK',span*scale
        light = bpy.data.objects.new('111 studio softbox', light_data)
        bpy.context.collection.objects.link(light)
        light.location = center+Vector(offset)*span
        light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
        lights.append(light)
    scene.world = bpy.data.worlds.new('111 neutral charcoal world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.10,.12,.15,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
    scene.render.engine = 'CYCLES'
    scene.cycles.samples,scene.cycles.use_denoising = 48, True
    scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage = size[0],size[1],100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for obj in lights+[camera]:
        bpy.data.objects.remove(obj,do_unlink=True)


records=[]
for kind in ['g3a3','l85','glock18']:
    base = import_original('m1911' if kind == 'glock18' else kind)
    base_frame = mesh_bounds()
    # The upgraded dimensions remain inside this exact frame, apart from tiny
    # physical edge details. Frame both with their union, never camera tricks.
    original_stats = (sum(len(o.data.vertices) for o in bpy.context.scene.objects if o.type=='MESH'),sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons))
    if kind == 'glock18':
        pistol()
    else:
        rifles(kind)
    new_frame = mesh_bounds()
    pair_frame = (Vector([min(base_frame[0][i],new_frame[0][i]) for i in range(3)]), Vector([max(base_frame[1][i],new_frame[1][i]) for i in range(3)]))
    objects = [o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in objects:
        obj['zoneVisualUpgrade'] = 111
        obj['nonfunctionalGameArt'] = True
    path = OUT / (kind+'-detail111.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    # One mesh with shared surface primitives, not dozens of cosmetic draw
    # calls in the inventory and the character view simultaneously.
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO')
    render(REVIEW / (kind+'-after.png'),pair_frame)
    render(OUT / (kind+'-thumbnail.png'),pair_frame,(384,280),True)
    data=path.read_bytes()
    gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    record={'id':kind+'-detail111','path':'assets/weapons/upgrades111/'+path.name,'bytes':len(data),'sha256':sha(path),'triangles':triangles,'primitives':sum(len(m['primitives']) for m in gltf['meshes']),'images':len(gltf.get('images',[])),'originalVertices':original_stats[0],'originalTriangles':original_stats[1],'physicalBoundsBlender':{'min':list(new_frame[0]),'max':list(new_frame[1])},'reviewFrame':{'min':list(pair_frame[0]),'max':list(pair_frame[1])},'thumbnail':path.stem.replace('-detail111','-thumbnail')+'.png'}
    records.append(record)
    import_original('m1911' if kind=='glock18' else kind)
    render(REVIEW / (kind+'-before.png'),pair_frame)
    print('ZONE111_RECORD',json.dumps(record))
(REVIEW/'build-receipt.json').write_text(json.dumps({'revision':111,'renderer':'Blender 4.5.9 CPU Cycles; asset evidence, not browser proof','assets':records},indent=2),encoding='utf-8')
