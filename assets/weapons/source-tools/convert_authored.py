import bpy, json, pathlib, sys, struct
from mathutils import Vector

# Convert only inspected author assets. No embedded source scripts execute.
args = sys.argv[sys.argv.index('--') + 1:]
mode, destination = args[0], pathlib.Path(args[1]).resolve()
destination.parent.mkdir(parents=True, exist_ok=True)
if mode == 'loafbrr-revolver':
    names = {'REV_Frame', 'LOW_CHamberLock', 'REV_Handle', 'REV_Cylinder', 'Hammer', 'LOW_CHamberRotate', 'REV_Trigger'}
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name in names]
    if len(meshes) != 7:
        raise RuntimeError('Source revolver parts changed; audit required')
elif mode in {'tabasco', 'tabasco-finish'}:
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    finish = mode == 'tabasco-finish'
    slug = pathlib.Path(bpy.data.filepath).stem.lower()
    wood_maps = None
    if finish and slug in {'mosin9130','dragunov','m1911'}:
        texture_root = pathlib.Path('artifacts/visual99-20261013/asset-research/v99/retained-texture-audit').resolve()
        color_map = bpy.data.images.load(str(texture_root/'2.jpg'),check_existing=False)
        normal_map = bpy.data.images.load(str(texture_root/'0.png'),check_existing=False)
        color_map.name = 'LonesomeDucky_CC0_Wood_BaseColor'
        normal_map.name = 'LonesomeDucky_CC0_Wood_Normal'
        normal_map.colorspace_settings.name = 'Non-Color'
        color_map.pack(); normal_map.pack(); wood_maps=(color_map,normal_map)
    for mat in bpy.data.materials:
        # Modern material conversion preserves the author's actual surface
        # color and declares that the source has no UV textures. No fake maps.
        color = tuple(mat.diffuse_color)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        nodes.clear()
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        output = nodes.new('ShaderNodeOutputMaterial')
        metal = max(color[:3]) - min(color[:3]) < 0.02
        wood = finish and not metal and wood_maps is not None
        bsdf.inputs['Base Color'].default_value = color if not finish else (.045,.060,.075,1) if metal else (.022,.031,.026,1)
        bsdf.inputs['Metallic'].default_value = (.88 if finish else .75) if metal else 0
        bsdf.inputs['Roughness'].default_value = (.47 if finish else .38) if metal else .82 if finish else .68
        if wood:
            mat.name = 'ZONE_adapted_walnut_' + mat.name
            image = nodes.new('ShaderNodeTexImage');image.image=wood_maps[0]
            normal_image=nodes.new('ShaderNodeTexImage');normal_image.image=wood_maps[1]
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.4
            mat.node_tree.links.new(image.outputs['Color'],bsdf.inputs['Base Color'])
            mat.node_tree.links.new(normal_image.outputs['Color'],normal.inputs['Color'])
            mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
            bsdf.inputs['Roughness'].default_value=.67
        elif finish:
            mat.name = ('ZONE_blued_steel_' if metal else 'ZONE_matte_polymer_') + mat.name
        mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    if finish and wood_maps:
        for obj in meshes:
            points=[obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
            minimum=Vector([min(point[a] for point in points) for a in range(3)])
            maximum=Vector([max(point[a] for point in points) for a in range(3)])
            spans=maximum-minimum
            axis=max(range(3),key=lambda a:spans[a])
            other=sorted(range(3),key=lambda a:spans[a],reverse=True)[1]
            uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='ZONE_CC0_wood_projection')
            for polygon in obj.data.polygons:
                for loop_index in polygon.loop_indices:
                    point=points[obj.data.loops[loop_index].vertex_index]
                    uv.data[loop_index].uv=(.03+.94*(point[other]-minimum[other])/max(spans[other],1e-6),
                        .42+.53*(point[axis]-minimum[axis])/max(spans[axis],1e-6))
elif mode == 'jean-safe':
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if {o.name for o in meshes} != {'Cylinder', 'Cylinder.007', 'Circle.004'}:
        raise RuntimeError('Double-barrel source geometry changed; audit required')
    # The original author's atlas incorporates third-party stock photographs.
    # Never export it. Replace all source materials with verified retained CC0
    # bat wood maps and an explicit physical steel material. Real geometry is
    # unchanged; projected UVs and material adaptation are declared in credits.
    texture_root = pathlib.Path('artifacts/visual99-20261013/asset-research/v99/retained-texture-audit').resolve()
    color_map = bpy.data.images.load(str(texture_root / '2.jpg'), check_existing=False)
    normal_map = bpy.data.images.load(str(texture_root / '0.png'), check_existing=False)
    color_map.name = 'LonesomeDucky_CC0_BatWood_BaseColor'
    normal_map.name = 'LonesomeDucky_CC0_BatWood_Normal'
    normal_map.colorspace_settings.name = 'Non-Color'
    color_map.pack(); normal_map.pack()
    for obj in meshes:
        old_slots = list(obj.data.materials)
        for index, old in enumerate(old_slots):
            wood = 'wood' in old.name.lower()
            mat = bpy.data.materials.new('CC0_adapted_wood' if wood else 'Physical_bluded_steel')
            mat.use_nodes = True
            nodes = mat.node_tree.nodes; nodes.clear()
            bsdf = nodes.new('ShaderNodeBsdfPrincipled'); output = nodes.new('ShaderNodeOutputMaterial')
            bsdf.inputs['Base Color'].default_value = (.10,.13,.16,1) if not wood else (.60,.44,.33,1)
            bsdf.inputs['Metallic'].default_value = .90 if not wood else 0
            bsdf.inputs['Roughness'].default_value = .31 if not wood else .57
            mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
            if wood:
                image = nodes.new('ShaderNodeTexImage'); image.image = color_map
                # Preserve color texture with a restrained walnut-like factor.
                multiply = nodes.new('ShaderNodeMixRGB'); multiply.blend_type = 'MULTIPLY'
                multiply.inputs[0].default_value = 1; multiply.inputs[2].default_value = (.60,.44,.33,1)
                mat.node_tree.links.new(image.outputs['Color'], multiply.inputs[1])
                mat.node_tree.links.new(multiply.outputs[0], bsdf.inputs['Base Color'])
                normal_image = nodes.new('ShaderNodeTexImage'); normal_image.image = normal_map
                normal = nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = .45
                mat.node_tree.links.new(normal_image.outputs['Color'], normal.inputs['Color'])
                mat.node_tree.links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
            obj.data.materials[index] = mat
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        minimum = Vector([min(p[a] for p in points) for a in range(3)])
        maximum = Vector([max(p[a] for p in points) for a in range(3)])
        spans = maximum-minimum
        axis = max(range(3), key=lambda a: spans[a])
        other = sorted(range(3), key=lambda a: spans[a], reverse=True)[1]
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='CC0_projected_wood')
        for polygon in obj.data.polygons:
            for loop_index in polygon.loop_indices:
                point = points[obj.data.loops[loop_index].vertex_index]
                # Sample only the inspected clean wood region of the author's
                # retained bat atlas, excluding paint, end caps and black area.
                uv.data[loop_index].uv = (.03 + .94*(point[other]-minimum[other])/max(spans[other],1e-6),
                    .42 + .53*(point[axis]-minimum[axis])/max(spans[axis],1e-6))
else:
    raise RuntimeError('Unapproved source conversion mode')

bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
bpy.context.scene.frame_set(1)
bpy.ops.object.convert(target='MESH')
for obj in bpy.context.selected_objects:
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = world
bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', use_selection=True,
    export_animations=False, export_skins=False, export_apply=True, export_yup=True)
if mode in {'jean-safe','tabasco-finish'}:
    # glTF cannot export Blender's color multiply node. Set its supported
    # baseColorFactor explicitly instead. Geometry and binary maps stay intact.
    blob = destination.read_bytes()
    json_size = struct.unpack_from('<I', blob, 12)[0]
    data = json.loads(blob[20:20+json_size])
    for material in data['materials']:
        if material['name'].startswith('CC0_adapted_wood'):
            material['pbrMetallicRoughness']['baseColorFactor'] = [.60,.44,.33,1]
        if material['name'].startswith('ZONE_adapted_walnut_'):
            material['pbrMetallicRoughness']['baseColorFactor'] = [.26,.20,.42,1]
    encoded = json.dumps(data, separators=(',', ':')).encode('utf8')
    encoded += b' ' * (-len(encoded) % 4)
    tail = blob[20+json_size:]
    destination.write_bytes(struct.pack('<4sIIII',b'glTF',2,20+len(encoded)+len(tail),len(encoded),0x4e4f534a)+encoded+tail)
print('AUTHORED_CONVERSION', json.dumps({'mode': mode, 'output': str(destination), 'bytes': destination.stat().st_size,
    'selectedParts': [obj.name for obj in bpy.context.selected_objects], 'geometryEdit': 'Static evaluated author pose; no vertex retopology or invented geometry',
    'surfaceEdit': 'None' if mode == 'loafbrr-revolver' else 'CC0 bat wood atlas with projected UVs and explicit steel material; all original photographic maps removed' if mode == 'jean-safe' else 'ZONE blued metal, matte polymer, projected CC0 bat walnut maps. Explicit adaptation, not original author color or PBR.' if mode == 'tabasco-finish' else 'Explicit modern physical material translation, preserving author colors; no texture maps'}))
