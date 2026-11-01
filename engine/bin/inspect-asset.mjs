import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Box3, Color, LoadingManager, Texture, Vector3 } from '../../lib/three184/three.module.js';
import { GLTFLoader } from '../../lib/three184/GLTFLoader.js';
import { OBJLoader } from '../../lib/three184/OBJLoader.js';
import { FBXLoader } from '../../lib/three184/FBXLoader.js';

const MAX_VERTICES = 3_000_000, MAX_TRIANGLES = 2_000_000, MAX_NODES = 50_000;
const MAX_BYTES = 125_829_120;
export function inspectorBudgetDiagnostics() {
  return {
    maxVertices: MAX_VERTICES,
    maxTriangles: MAX_TRIANGLES,
    maxNodes: MAX_NODES,
    maxBytes: MAX_BYTES,
    supportedFormats: ['glb', 'gltf', 'obj', 'fbx'],
  };
}
export function isSupportedInspectorFormat(format) {
  return ['glb', 'gltf', 'obj', 'fbx'].includes(String(format || '').toLowerCase());
}
export function isWithinInspectorBudget({ vertices = 0, triangles = 0, nodes = 0, bytes = 0 } = {}) {
  return vertices >= 0 && vertices <= MAX_VERTICES && triangles >= 0 && triangles <= MAX_TRIANGLES && nodes >= 0 && nodes <= MAX_NODES && bytes >= 0 && bytes <= MAX_BYTES;
}
const safeVector = v => [v.x, v.y, v.z].map(n => Math.round(n * 1e7) / 1e7);
// Browser-only progress notifications do not alter the parsed geometry.
globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init = {}) { super(type); Object.assign(this, init); }
};

function cleanMember(member) {
  if (typeof member !== 'string' || !member || member.length > 500 || /[\\\x00-\x1f:%?#<>"|]/.test(member) || member.startsWith('/') || member.split('/').some(s => !s || s === '.' || s === '..')) throw Error('Unsafe model resource path.');
  return member;
}

async function boundedRead(root, member) {
  cleanMember(member);
  const location = path.resolve(root, member), resolved = await fs.realpath(location), base = await fs.realpath(root);
  if (!resolved.startsWith(base + path.sep)) throw Error('Model resource escapes its bundle.');
  const stat = await fs.stat(resolved);
  if (!stat.isFile() || stat.size > MAX_BYTES) throw Error('Model resource exceeds its byte budget.');
  return fs.readFile(resolved);
}

async function gltfData(root, entry, format) {
  const bytes = await boundedRead(root, entry);
  let json, binary;
  if (format === 'glb') {
    if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB container.');
    let at = 12;
    while (at < bytes.length) {
      const length = bytes.readUInt32LE(at), type = bytes.readUInt32LE(at + 4); at += 8;
      if (at + length > bytes.length || length % 4) throw Error('Invalid GLB chunk bounds.');
      if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8', at, at + length));
      if (type === 0x004e4942) binary = bytes.subarray(at, at + length);
      at += length;
    }
  } else json = JSON.parse(bytes.toString('utf8'));
  if (json?.asset?.version !== '2.0') throw Error('Only glTF 2.0 geometry is supported.');
  if ((json.extensionsRequired || []).some(x => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(x))) throw Error('Compressed glTF must be exported uncompressed before inspection.');
  if ((json.nodes || []).length > MAX_NODES) throw Error('Model node budget exceeded.');
  for (let i = 0; i < (json.buffers || []).length; i++) {
    const buffer = json.buffers[i];
    let payload;
    if (!buffer.uri && i === 0 && binary) payload = binary;
    else if (typeof buffer.uri === 'string' && buffer.uri.startsWith('data:')) {
      if (!/^data:application\/(?:octet-stream|gltf-buffer);base64,[A-Za-z0-9+/=\r\n]+$/.test(buffer.uri)) throw Error('Unsupported glTF data buffer URI.');
      payload = Buffer.from(buffer.uri.slice(buffer.uri.indexOf(',') + 1), 'base64');
    } else {
      const reference = decodeURIComponent(buffer.uri || '');
      if (/^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith('/') || /[\\\x00-\x1f:%?#<>"|]/.test(reference)) throw Error('External glTF buffer is not permitted.');
      payload = await boundedRead(root, path.posix.join(path.posix.dirname(entry), reference));
    }
    if (buffer.byteLength > payload.length || payload.length > MAX_BYTES) throw Error('glTF buffer is truncated or too large.');
    buffer.uri = 'data:application/octet-stream;base64,' + payload.toString('base64');
  }
  // Geometry inspection does not fetch/decode images or run material programs.
  // Actual source textures remain untouched and load in the browser viewer.
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) delete primitive.material;
  json.materials = []; json.textures = []; json.images = []; json.samplers = [];
  const result = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  return { scene: result.scene, animations: result.animations || [] };
}

function geometryThumbnail(triangles, bounds) {
  if (!triangles.length) return null;
  const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z, 1e-8), factor = 160 / extent;
  const project = p => [210 + (p.x - center.x - (p.z - center.z)) * .78 * factor, 155 - ((p.y - center.y) - ((p.x - center.x) + (p.z - center.z)) * .32) * factor];
  const rendered = triangles.map(({ vertices, color }) => {
    const points = vertices.map(project).map(p => p.map(n => Number(n.toFixed(1))).join(',')).join(' ');
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    const shade = .45 + Math.abs(normal.dot(new Vector3(.3,.85,.4).normalize())) * .55;
    const tint = color.clone().multiplyScalar(shade).getHexString();
    return { points, tint, depth: vertices.reduce((n, p) => n + p.x + p.z, 0) };
  }).sort((a,b) => b.depth - a.depth);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300"><rect width="420" height="300" fill="#111a1c"/><path d="M24 250H396M210 24V270" stroke="#27383a" stroke-width="1"/>' + rendered.map(t => `<polygon points="${t.points}" fill="#${t.tint}" stroke="#1a2528" stroke-width=".35"/>`).join('') + '<text x="12" y="288" font-family="sans-serif" font-size="11" fill="#d6c294">Geometry preview. Original textures load in the inspector.</text></svg>';
}

export async function inspectAsset(root, entry, format) {
  cleanMember(entry);
  let scene, animations = [], warnings = [];
  if (format === 'glb' || format === 'gltf') ({ scene, animations } = await gltfData(root, entry, format));
  else if (format === 'obj') {
    const bytes = await boundedRead(root, entry);
    scene = new OBJLoader().parse(bytes.toString('utf8'));
    warnings.push('OBJ has no skeletal rig or animation. Materials are inspected in the browser.');
  } else if (format === 'fbx') {
    const manager = new LoadingManager();
    manager.addHandler(/.*/, { path: '', setPath(value) { this.path = value; return this; }, load: (_url, loaded) => { const texture = new Texture(); if (loaded) queueMicrotask(() => loaded(texture)); return texture; } });
    globalThis.window ??= { URL: globalThis.URL };
    const bytes = await boundedRead(root, entry);
    scene = new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    animations = scene.animations || [];
    warnings.push('FBX image decoding is deferred to the browser; bundle external textures in the same ZIP.');
  } else throw Error('Unsupported model format.');
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene, true);
  if (bounds.isEmpty() || ![...safeVector(bounds.min), ...safeVector(bounds.max)].every(Number.isFinite)) throw Error('Model has no finite visible geometry.');
  const size = bounds.getSize(new Vector3()), maximum = Math.max(size.x, size.y, size.z);
  if (maximum < 1e-8 || maximum > 1e12) throw Error('Model dimensions are outside the normalization range.');
  let nodes = 0, meshes = 0, vertices = 0, triangleCount = 0, skinnedMeshes = 0;
  const sampled = [];
  scene.traverse(object => {
    if (++nodes > MAX_NODES) throw Error('Model has too many objects for an interactive preview.');
    if (!object.isMesh && !object.isLine && !object.isPoints) return;
    const position = object.geometry?.getAttribute('position'); if (!position) return;
    if (++meshes > 20_000 || (vertices += position.count) > MAX_VERTICES) throw Error('Model vertex/mesh budget exceeded.');
    for (let i = 0; i < position.array.length; i++) if (!Number.isFinite(position.array[i])) throw Error('Model contains non-finite vertex coordinates.');
    const index = object.geometry.index, count = index ? index.count : position.count;
    if (object.isMesh) triangleCount += Math.floor(count / 3);
    if (triangleCount > MAX_TRIANGLES) throw Error('Model exceeds two million triangles; reduce its mesh complexity.');
    // Every draw index must be valid, including lines/points and geometry
    // outside the bounded thumbnail sample. Sampling is presentation only.
    if (index) for (let i = 0; i < index.count; i++) {
      const at = index.getX(i);
      if (!Number.isInteger(at) || at < 0 || at >= position.count) throw Error('Model primitive references a missing vertex.');
    }
    if (object.isSkinnedMesh) skinnedMeshes++;
    if (!object.isMesh) return;
    const sampleEvery = Math.max(1, Math.ceil(count / (3 * 80)));
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const color = material?.color?.clone() || new Color('#c7b792');
    for (let i = 0; i + 2 < count && sampled.length < 1600; i += 3 * sampleEvery) {
      const points = [0,1,2].map(offset => {
        const at = index ? index.getX(i + offset) : i + offset;
        if (!Number.isInteger(at) || at < 0 || at >= position.count) throw Error('Model triangle references a missing vertex.');
        return new Vector3().fromBufferAttribute(position, at).applyMatrix4(object.matrixWorld);
      });
      sampled.push({ vertices: points, color });
    }
  });
  if (!vertices) throw Error('Model has no actual vertices.');
  const svg = geometryThumbnail(sampled, bounds);
  if (!skinnedMeshes) warnings.push('No skinned character rig detected. This asset can be placed as geometry; automatic clothing/hand binding is not implied.');
  return {
    bounds: { min: safeVector(bounds.min), max: safeVector(bounds.max), center: safeVector(bounds.getCenter(new Vector3())), size: safeVector(size) },
    pivot: { centerXZ: [bounds.getCenter(new Vector3()).x, bounds.getCenter(new Vector3()).z], floor: bounds.min.y },
    normalizedScale: Math.min(10000, Math.max(0.000001, 3 / maximum)),
    vertices, triangles: triangleCount, meshes, nodes, skinnedMeshes, animations: animations.map(a => ({ name: String(a.name).slice(0, 120), duration: a.duration })).slice(0, 100),
    thumbnail: svg ? 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') : null,
    thumbnailKind: svg ? 'geometry-projection' : null,
    warnings,
  };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  // Keep the machine-readable result free of parser progress/warning chatter.
  console.log = (...parts) => process.stderr.write(parts.map(String).join(' ').slice(0,1000) + '\n');
  try {
    const result = await inspectAsset(process.argv[2], process.argv[3], process.argv[4]);
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: String(error?.message || 'Unable to inspect this model').slice(0, 350) }));
    process.exitCode = 1;
  }
}
