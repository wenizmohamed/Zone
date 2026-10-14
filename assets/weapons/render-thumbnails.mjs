// Deterministic technical renders of retained licensed meshes, not stock art.
// Original vertex buffers, author scale and grip metadata remain unchanged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import * as THREE from '../../lib/three184/three.module.js';
import { OBJLoader } from '../../lib/three184/OBJLoader.js';
import { MTLLoader } from '../../lib/three184/MTLLoader.js';
import { GLTFLoader } from '../../lib/three184/GLTFLoader.js';
import { resolveWeaponAsset, normalizeWeaponAsset, catalogMaterialProfile, inspectWeaponObject } from '../../dist/weapon-assets.js';
import { computeWeaponFrame } from '../../dist/weapon-presentation.js';

const root = new URL('../../', import.meta.url), context = vm.createContext({});
vm.runInContext(readFileSync(new URL('assets/weapons/catalog.js', root), 'utf8'), context);
const catalog = context.ZONE_WEAPONS, palette = context.ZONE_WEAPON_MATS;
const game = JSON.parse(readFileSync(new URL('engine/data/gameplay-catalog.json', root), 'utf8'));
const keys = Object.entries(game.items).filter(([, value]) => value.type === 'weapon').map(([key]) => key);
const hash = data => createHash('sha256').update(data).digest('hex');
const xml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

function glbData(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid GLB');
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8', offset, offset + length));
    if (type === 0x004e4942) binary = bytes.subarray(offset, offset + length);
    offset += length;
  }
  return { json, binary };
}

function baseColorAverages(json, binary) {
  const images = (json.images || []).map(image => {
    const view = json.bufferViews[image.bufferView];
    return binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength).toString('base64');
  });
  if (!images.length) return [];
  // Image analysis only. Pillow reads embedded pixel bytes from stdin and
  // returns mean color; it writes no files and does not change source images.
  const script = "import base64,io,json,sys\nfrom PIL import Image,ImageStat\nprint(json.dumps([ImageStat.Stat(Image.open(io.BytesIO(base64.b64decode(s))).convert('RGB')).mean for s in json.load(sys.stdin)]))";
  const result = spawnSync('python', ['-c', script], { input: JSON.stringify(images), encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Embedded texture analysis failed: ' + result.stderr);
  const averages = JSON.parse(result.stdout);
  return (json.materials || []).map(material => {
    const texture = json.textures?.[material.pbrMetallicRoughness?.baseColorTexture?.index];
    return texture ? averages[texture.source] : null;
  });
}

function textureFreeGlb(bytes, json) {
  const retained = JSON.parse(JSON.stringify(json));
  const stripTextures = value => {
    for (const [key, child] of Object.entries(value)) {
      if (/Texture$/.test(key)) delete value[key];
      else if (child && typeof child === 'object') stripTextures(child);
    }
  };
  stripTextures(retained); delete retained.images; delete retained.textures; delete retained.samplers;
  const encoded = Buffer.from(JSON.stringify(retained)), padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(padded);
  const tail = bytes.subarray(20 + bytes.readUInt32LE(12));
  const output = Buffer.alloc(20 + padded.length + tail.length);
  output.write('glTF'); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); tail.copy(output, 20 + padded.length);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}

const sourceCache = new Map();
async function geometryFor(descriptor) {
  if (!sourceCache.has(descriptor.id)) {
    const path = 'assets/weapons/' + (descriptor.url || descriptor.file + '.obj');
    const bytes = readFileSync(new URL(path, root));
    let object, sourceInfo;
    if (descriptor.format === 'obj') {
      const materials = new MTLLoader().parse(readFileSync(new URL('assets/weapons/' + descriptor.file + '.mtl', root), 'utf8'), '');
      materials.preload(); object = new OBJLoader().setMaterials(materials).parse(bytes.toString('utf8'));
      const replacements = new Map();
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        const material = old => {
          if (!replacements.has(old.name)) { const value = new THREE.MeshPhysicalMaterial(catalogMaterialProfile(old.name, palette)); value.name = old.name; replacements.set(old.name, value); }
          return replacements.get(old.name);
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material) : material(mesh.material);
      });
      sourceInfo = { images: 0, textureMaps: 0 };
    } else {
      const { json, binary } = glbData(bytes), averages = baseColorAverages(json, binary);
      const gltf = await new GLTFLoader().parseAsync(textureFreeGlb(bytes, json), ''); object = gltf.scene;
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const index = gltf.parser.associations.get(material)?.materials
            ?? json.materials.findIndex(source => source.name && source.name === material.name);
          if (averages[index]) material.color.multiply(new THREE.Color(...averages[index].map(value => value / 255)).convertSRGBToLinear());
        }
      });
      sourceInfo = { images: json.images?.length || 0, textureMaps: json.textures?.length || 0 };
    }
    sourceCache.set(descriptor.id, { object, path, sha256: hash(bytes), bytes: bytes.length, sourceInfo });
  }
  const source = sourceCache.get(descriptor.id);
  return { ...source, object: normalizeWeaponAsset(THREE, source.object.clone(true), descriptor) };
}

function meshRender(object, info) {
  const display = new THREE.Group(); display.add(object);
  if (info.category === 'melee' && info.key === 'bat') display.rotation.z = -Math.PI / 2;
  display.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(display), frame = computeWeaponFrame(THREE, box, 320 / 192, 38);
  // Static technical thumbnails have no toolbar or camera orbit to reserve.
  frame.position.sub(frame.target).multiplyScalar(.88).add(frame.target);
  const camera = new THREE.PerspectiveCamera(38, 320 / 192, frame.near, frame.far);
  camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
  const light = new THREE.Vector3(-.35, .8, 1).normalize(), faces = [];
  display.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const total = index?.count || positions.count, groups = mesh.geometry.groups;
    for (let offset = 0; offset < total; offset += 3) {
      const points = [0, 1, 2].map(i => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(offset + i) : offset + i).applyMatrix4(mesh.matrixWorld));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(3);
      if (normal.dot(camera.position.clone().sub(center)) < 0) continue;
      const projected = points.map(point => point.clone().project(camera));
      const coordinates = projected.map(point => [(point.x + 1) * 160, (1 - point.y) * 96]);
      const area = Math.abs((coordinates[1][0] - coordinates[0][0]) * (coordinates[2][1] - coordinates[0][1]) - (coordinates[2][0] - coordinates[0][0]) * (coordinates[1][1] - coordinates[0][1]));
      if (area < .05) continue;
      const group = groups.find(group => offset >= group.start && offset < group.start + group.count);
      const material = Array.isArray(mesh.material) ? mesh.material[group?.materialIndex || 0] : mesh.material;
      const brightness = .9 + Math.max(0, normal.dot(light)) * .9;
      const color = (material.color || new THREE.Color(0x7f8993)).clone().multiplyScalar(brightness);
      color.lerp(new THREE.Color(0xb1bec7), .05 + (material.metalness || 0) * .10 + Math.pow(Math.max(0, normal.dot(camera.position.clone().sub(center).normalize())), 9) * (material.metalness || 0) * .12);
      faces.push({ depth: projected.reduce((sum, point) => sum + point.z, 0), path: coordinates.map(point => point.map(value => value.toFixed(2)).join(',')).join(' '), color: color.getHexString() });
    }
  });
  faces.sort((a, b) => b.depth - a.depth);
  if (!faces.length) throw new Error('Mesh render produced no visible triangles: ' + info.key);
  const metadata = xml(JSON.stringify(info));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 192" role="img"><title>${xml(info.name)}</title><desc>Shaded technical render of the retained ${xml(info.modelId)} mesh. ${xml(info.author)}. ${xml(info.license)}. Surface colors use original materials and mean embedded texture colors; this thumbnail does not bake PBR maps.</desc><metadata>${metadata}</metadata><defs><radialGradient id="stage"><stop stop-color="#333b40"/><stop offset="1" stop-color="#191f24"/></radialGradient></defs><rect width="320" height="192" rx="12" fill="url(#stage)"/><ellipse cx="160" cy="164" rx="105" ry="7" fill="#101619" opacity=".55"/>${faces.map(face => `<polygon points="${face.path}" fill="#${face.color}" stroke="#${face.color}" stroke-width=".25"/>`).join('')}</svg>\n`;
}

const write = process.argv.includes('--write'), records = [];
if (write) mkdirSync(new URL('assets/weapons/thumbnails/', root), { recursive: true });
for (const key of keys) {
  const descriptor = resolveWeaponAsset(key, catalog);
  if (!descriptor) throw new Error('Missing runtime weapon descriptor: ' + key);
  const source = await geometryFor(descriptor), inspection = inspectWeaponObject(THREE, source.object);
  const record = { key, name: context.ZONE_WEAPON_NAMES?.en?.[key] || ({ bat: 'Wooden bat', knife: 'M9 knife' })[key] || key,
    modelId: descriptor.id, category: descriptor.category, quality: descriptor.quality, author: descriptor.author, license: descriptor.license,
    source: descriptor.source, modelPath: source.path, sourceSha256: source.sha256, sourceBytes: source.bytes, sourceImages: source.sourceInfo.images,
    scale: descriptor.scale, grip: descriptor.grip, rotation: descriptor.rotation,
    ...(descriptor.excludeNodes ? { excludedDisplayNodes: descriptor.excludeNodes } : {}),
    ...(descriptor.aiAssisted ? { aiAssisted: true, surfaceMaps: descriptor.surfaceMaps, normalMap: descriptor.normalMap, identityNote: descriptor.identityNote } : {}),
    ...inspection, thumbnail: descriptor.thumbnail };
  const svg = meshRender(source.object, record); record.thumbnailSha256 = hash(svg); record.thumbnailBytes = Buffer.byteLength(svg);
  if (write) writeFileSync(new URL(descriptor.thumbnail.slice(1), root), svg, 'utf8');
  records.push(record);
}
const report = { generator: 'retained-mesh-shaded-render', sourceGeometryChanged: false, pbrMapsBakedInThumbnails: false,
  canonicalModelMappingsUpdated: ['pistol_t', 'shotgun', 'smg', 'sniper', 'assaultrifle_1', 'magnum', 'sawedoff', 'bullpup_1'],
  runtimeWeapons: records.length, uniqueRenderedAssets: new Set(records.map(record => record.modelId)).size,
  categories: [...new Set(records.map(record => record.category))], records };
if (write) writeFileSync(new URL('assets/weapons/runtime-coverage.json', root), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
