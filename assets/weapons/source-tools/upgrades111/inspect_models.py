"""Read-only source mesh inspection, run by the retained portable Blender."""
import bpy
import math
import bmesh
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT.parents[1] / '.tools' / 'v111-weapons'
for name in ('g3a3', 'l85'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'premium' / 'v99' / ('tabasco-' + name + '.glb')))
    print('SOURCE', name)
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        coords = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
        lo = [min(p[i] for p in coords) for i in range(3)]
        hi = [max(p[i] for p in coords) for i in range(3)]
        print(obj.name, len(obj.data.vertices), len(obj.data.polygons), [slot.material.name for slot in obj.material_slots], 'bounds', lo, hi)
        scale = .1 if name == 'g3a3' else .081
        grip = Vector((-2, 0, -.6) if name == 'g3a3' else (-.5, 3.8161939442, -.8))
        transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-grip) @ Matrix.Rotation(-math.pi/2, 4, 'Z') @ obj.matrix_world
        obj.data.transform(transform)
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()
        bpy.context.view_layer.update()
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        remaining = set(bm.verts)
        while remaining:
            todo, connected = [remaining.pop()], []
            while todo:
                v = todo.pop()
                connected.append(v)
                for edge in v.link_edges:
                    other = edge.other_vert(v)
                    if other in remaining:
                        remaining.remove(other)
                        todo.append(other)
            print('ISLAND', len(connected), 'bounds', [round(min(v.co[j] for v in connected), 5) for j in range(3)], [round(max(v.co[j] for v in connected), 5) for j in range(3)])
        bm.free()
        for i, slot in enumerate(obj.material_slots):
            points = [obj.data.vertices[v].co for p in obj.data.polygons if p.material_index == i for v in p.vertices]
            print('PART', i, slot.material.name, 'bounds', [round(min(p[j] for p in points), 6) for j in range(3)], [round(max(p[j] for p in points), 6) for j in range(3)])
    camera_data = bpy.data.cameras.new('Inspection camera')
    camera = bpy.data.objects.new('Inspection camera', camera_data)
    bpy.context.collection.objects.link(camera)
    points = [obj.matrix_world @ Vector(p) for obj in bpy.context.scene.objects if obj.type == 'MESH' for p in obj.bound_box]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    center = (lo + hi) / 2
    camera.location = center + Vector((.20, -1, .22)) * (hi.x - lo.x) * 1.6
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = (hi.x - lo.x) * 1.3
    bpy.context.scene.camera = camera
    for pos, power, size in [((0,-1.0,1.5),250,1.4),((0,1.0,.6),300,.8),((1,-.3,.5),80,.6)]:
        data = bpy.data.lights.new('Inspection softbox', 'AREA')
        data.energy, data.shape, data.size = power, 'DISK', size
        light = bpy.data.objects.new('Inspection softbox', data)
        bpy.context.collection.objects.link(light)
        light.location = center + Vector(pos)
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1100, 620, 100
    scene.world = bpy.data.worlds.new('Inspection world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.10,.12,.15,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
    scene.render.filepath = str(REVIEW / (name + '-before.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(REVIEW / 'Glock_HighPoly.obj'))
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        print('GLOCK', obj.name, len(obj.data.vertices), len(obj.data.polygons), 'bounds', [tuple(p) for p in obj.bound_box], [m.name for m in obj.data.materials])
        for i, slot in enumerate(obj.material_slots):
            points = [obj.data.vertices[v].co for p in obj.data.polygons if p.material_index == i for v in p.vertices]
            print('GLOCK PART', i, slot.material.name, 'bounds', [round(min(p[j] for p in points), 6) for j in range(3)], [round(max(p[j] for p in points), 6) for j in range(3)])
