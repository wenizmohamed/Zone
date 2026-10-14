import bpy, json

# Read-only source audit. Blender is invoked with --disable-autoexec.
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    obj.data.calc_loop_triangles()
    print('SOURCE_MESH', json.dumps({'name': obj.name, 'triangles': len(obj.data.loop_triangles), 'dimensions': list(obj.dimensions), 'location': list(obj.location), 'rotation': list(obj.rotation_euler), 'scale': list(obj.scale), 'hideRender': obj.hide_render, 'hideViewport': obj.hide_viewport, 'materials': [mat.name for mat in obj.data.materials if mat]}))
for mat in bpy.data.materials:
    nodes = []
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                nodes.append({'name': node.name, 'image': node.image.name, 'path': node.image.filepath, 'size': list(node.image.size), 'packed': bool(node.image.packed_file)})
    print('SOURCE_MATERIAL', json.dumps({'name': mat.name, 'color': list(mat.diffuse_color), 'roughness': mat.roughness, 'metallic': mat.metallic, 'nodes': nodes}))
