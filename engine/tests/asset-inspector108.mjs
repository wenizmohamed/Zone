import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAsset, inspectorBudgetDiagnostics, isSupportedInspectorFormat, isWithinInspectorBudget, maxInspectorVertices, maxInspectorTriangles, maxInspectorNodes, maxInspectorBytes, maxInspectorMeshes, maxSampledThumbnailTriangles, supportedInspectorFormats, supportedInspectorFormatCount } from '../bin/inspect-asset.mjs';

const root = fileURLToPath(new URL('../var/', import.meta.url));
await fs.mkdir(root, { recursive: true });
const fixtures = await fs.mkdtemp(path.join(root, 'model-inspector108-'));
const vertices = Buffer.alloc(36);
[0,0,0, 2,0,0, 0,3,0].forEach((n,i) => vertices.writeFloatLE(n, i * 4));
const gltf = uri => ({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri,byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[2,3,0]}]});
const obj = 'o Triangle\nv 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n';
await fs.writeFile(path.join(fixtures, 'triangle.obj'), obj);
await fs.writeFile(path.join(fixtures, 'triangle.bin'), vertices);
await fs.writeFile(path.join(fixtures, 'triangle.gltf'), JSON.stringify(gltf('triangle.bin')));
await fs.writeFile(path.join(fixtures, 'triangle.fbx'), `; FBX 7.4.0 project file
FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
}
Objects:  {
\tGeometry: 100, "Geometry::Triangle", "Mesh" {
\t\tVertices: *9 {
\t\t\ta: 0,0,0,2,0,0,0,3,0
\t\t}
\t\tPolygonVertexIndex: *3 {
\t\t\ta: 0,1,-3
\t\t}
\t}
\tModel: 200, "Model::Triangle", "Mesh" {
\t\tVersion: 232
\t\tShading: T
\t\tCulling: "CullingOff"
\t}
}
Connections:  {
\tC: "OO",100,200
\tC: "OO",200,0
}
`);

test('OBJ inspection reports actual geometry and labels its real projection thumbnail', async () => {
  const view = await inspectAsset(fixtures, 'triangle.obj', 'obj');
  assert.deepEqual(view.bounds.size, [2,3,0]); assert.equal(view.triangles, 1);
  const svg = Buffer.from(view.thumbnail.split(',')[1], 'base64').toString();
  assert.match(svg, /<polygon points=/); assert.match(svg, /Geometry preview/); assert.equal(view.thumbnailKind, 'geometry-projection');
});
test('glTF reads bundled buffers rather than guessing accessor bounds', async () => {
  const wrongMetadata = gltf('triangle.bin'); wrongMetadata.accessors[0].min = [-100,-100,-100]; wrongMetadata.accessors[0].max = [100,100,100];
  await fs.writeFile(path.join(fixtures, 'wrong.gltf'), JSON.stringify(wrongMetadata));
  const view = await inspectAsset(fixtures, 'wrong.gltf', 'gltf');
  assert.deepEqual(view.bounds.size, [2,3,0]); assert.equal(view.vertices, 3);
});
test('FBX uses the real official loader and returns actual triangle geometry', async () => {
  const view = await inspectAsset(fixtures, 'triangle.fbx', 'fbx');
  assert.deepEqual(view.bounds.size, [2,3,0]); assert.equal(view.triangles, 1); assert.equal(view.vertices, 3);
});
test('binary glTF retains real skeleton and authored animation metadata', async () => {
  const view = await inspectAsset(fileURLToPath(new URL('../../assets/character/quaternius/', import.meta.url)), 'Suit.glb', 'glb');
  assert.equal(view.skinnedMeshes, 13); assert.equal(view.triangles, 7674); assert.equal(view.vertices, 15349);
  assert.ok(view.animations.some(clip => clip.name === 'Idle')); assert.ok(view.animations.some(clip => clip.name === 'Idle_Gun'));
});
test('external glTF buffers never become network requests', async () => {
  await fs.writeFile(path.join(fixtures, 'external.gltf'), JSON.stringify(gltf('https://example.invalid/private.bin')));
  await assert.rejects(inspectAsset(fixtures, 'external.gltf', 'gltf'), /External glTF buffer/);
});
test('parent traversal cannot escape the provided asset directory', async () => {
  await fs.writeFile(path.join(fixtures, 'escape.gltf'), JSON.stringify(gltf('../outside.bin')));
  await assert.rejects(inspectAsset(fixtures, 'escape.gltf', 'gltf'), /Unsafe model resource path/);
  await assert.rejects(inspectAsset(fixtures, '../triangle.obj', 'obj'), /Unsafe model resource path/);
});
test('non-finite geometry and empty models are not reported ready', async () => {
  await fs.writeFile(path.join(fixtures, 'empty.obj'), '# empty\n');
  await assert.rejects(inspectAsset(fixtures, 'empty.obj', 'obj'), /no finite visible geometry/);
  const invalid = Buffer.from(vertices); invalid.writeFloatLE(Infinity, 0); await fs.writeFile(path.join(fixtures, 'invalid.bin'), invalid);
  await fs.writeFile(path.join(fixtures, 'invalid.gltf'), JSON.stringify(gltf('invalid.bin')));
  await assert.rejects(inspectAsset(fixtures, 'invalid.gltf', 'gltf'), /finite/);
});

async function indexedFixture(name, { invalidAt = null, invalidValue = 65535, mode = 4, meshes = 1, count = 900 } = {}) {
  const good = Buffer.alloc(count * 2);
  for (let index = 0; index < count; index++) good.writeUInt16LE(index % 3, index * 2);
  const indexed = Buffer.from(good);
  if (invalidAt !== null) indexed.writeUInt16LE(invalidValue, invalidAt * 2);
  const binary = Buffer.concat([vertices, good, indexed]);
  const scene = gltf('data:application/octet-stream;base64,' + binary.toString('base64'));
  scene.buffers[0].byteLength = binary.length;
  scene.bufferViews.push({buffer:0,byteOffset:36,byteLength:good.length},{buffer:0,byteOffset:36+good.length,byteLength:indexed.length});
  scene.accessors.push({bufferView:1,componentType:5123,count,type:'SCALAR'},{bufferView:2,componentType:5123,count,type:'SCALAR'});
  scene.meshes = [{primitives:[{attributes:{POSITION:0},indices:1,mode}]},{primitives:[{attributes:{POSITION:0},indices:2,mode}]}];
  scene.nodes = Array.from({length:meshes}, (_, index) => ({mesh:index === meshes - 1 ? 1 : 0}));
  scene.scenes[0].nodes = scene.nodes.map((_, index) => index);
  await fs.writeFile(path.join(fixtures,name),JSON.stringify(scene),'utf8');
  return inspectAsset(fixtures,name,'gltf');
}

test('all indexed triangles are validated outside the thumbnail sampling cadence', async () => {
  await assert.rejects(indexedFixture('unsampled-index.gltf',{invalidAt:3}),/references a missing vertex/);
});
test('the final draw index cannot hide beyond the last thumbnail sample', async () => {
  await assert.rejects(indexedFixture('last-index.gltf',{invalidAt:899}),/references a missing vertex/);
});
test('an index exactly equal to the vertex count is rejected at the buffer boundary', async () => {
  await assert.rejects(indexedFixture('index-boundary.gltf',{invalidAt:3,invalidValue:3}),/references a missing vertex/);
});
test('thumbnail sample exhaustion cannot skip later meshes geometry validation', async () => {
  await assert.rejects(indexedFixture('late-mesh-index.gltf',{invalidAt:0,meshes:22}),/references a missing vertex/);
});
test('indexed line primitives receive the same complete vertex-reference validation', async () => {
  await assert.rejects(indexedFixture('line-index.gltf',{invalidAt:401,mode:1}),/references a missing vertex/);
});
test('indexed point primitives receive the same complete vertex-reference validation', async () => {
  await assert.rejects(indexedFixture('point-index.gltf',{invalidAt:401,mode:0}),/references a missing vertex/);
});
test('valid indexed geometry preserves actual counts and the bounded projection thumbnail', async () => {
  const view = await indexedFixture('valid-indices.gltf');
  assert.equal(view.vertices,3); assert.equal(view.triangles,300);
  assert.deepEqual(view.bounds.size,[2,3,0]); assert.equal(view.thumbnailKind,'geometry-projection');
  assert.equal(maxInspectorVertices(), 3_000_000);
  assert.equal(maxInspectorTriangles(), 2_000_000);
  assert.equal(maxInspectorNodes(), 50_000);
  assert.equal(maxInspectorBytes(), 125_829_120);
  assert.equal(maxInspectorMeshes(), 20_000);
  assert.equal(maxSampledThumbnailTriangles(), 1600);
  assert.deepEqual(supportedInspectorFormats(), ['glb', 'gltf', 'obj', 'fbx']);
  assert.equal(supportedInspectorFormatCount(), 4);
  assert.equal(isSupportedInspectorFormat('glb'), true);
  assert.equal(isSupportedInspectorFormat('blend'), false);
  assert.equal(isWithinInspectorBudget({ vertices: 100, triangles: 50, nodes: 10, bytes: 1024 }), true);
  assert.equal(isWithinInspectorBudget({ vertices: 4_000_000 }), false);
  assert.equal(inspectorBudgetDiagnostics().maxTriangles, 2_000_000);
});
