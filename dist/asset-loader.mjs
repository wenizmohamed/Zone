import * as THREE from '../lib/three184/three.module.js';
import { GLTFLoader } from '../lib/three184/GLTFLoader.js';
import { FBXLoader } from '../lib/three184/FBXLoader.js';
import { OBJLoader } from '../lib/three184/OBJLoader.js';
import { MTLLoader } from '../lib/three184/MTLLoader.js';

export const ASSET_CHUNK_BYTES = 524288;
export const ASSET_MAX_BYTES = 134217728;
const HASH = /^[a-f0-9]{64}$/;
const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'fbx', 'obj']);
const EMBEDDED = /^data:(?:image\/(?:png|jpeg|webp|gif|bmp)|application\/(?:octet-stream|gltf-buffer));base64,[a-z\d+/=\s]+$/i;

export function supportedModelExtensions() {
  return [...MODEL_EXTENSIONS];
}

export function isSupportedModelExtension(extension) {
  return typeof extension === 'string' && MODEL_EXTENSIONS.has(extension.toLowerCase());
}

export function isEmbeddedDataUri(uri) {
  return typeof uri === 'string' && EMBEDDED.test(uri);
}

export function isValidAssetId(id) {
  return typeof id === 'string' && HASH.test(id);
}

export function assetChunkCount(totalBytes) {
  return Math.max(1, Math.ceil(Math.max(0, Number(totalBytes) || 0) / ASSET_CHUNK_BYTES));
}

export function isAssetWithinByteBudget(totalBytes) {
  return Number.isSafeInteger(totalBytes) && totalBytes >= 0 && totalBytes <= ASSET_MAX_BYTES;
}

export function maxAssetMemberCount() {
  return 512;
}

export function supportedNonModelExtensions() {
  return ['png', 'jpg', 'jpeg', 'webp', 'mp3'];
}

export function isSupportedNonModelExtension(extension) {
  return typeof extension === 'string' && supportedNonModelExtensions().includes(extension.toLowerCase());
}

export function maxParallelAssetStreams() {
  return 3;
}

export function isAssetManifestReady(asset) {
  return Boolean(asset && asset.status === 'ready' && Array.isArray(asset.members) && asset.members.length > 0);
}

export function defaultNormalizedTargetSize() {
  return 2;
}

export function maxAssetRequestPathLength() {
  return 2048;
}

export function maxAssetTransformScale() {
  return 10000;
}

export function minAssetTransformScale() {
  return .000001;
}

export function maxAssetTransformOffset() {
  return 10000;
}

export function defaultAssetBaseUrl() {
  return '/api/v1/assets/';
}

export function assetBundleUrlPrefix() {
  return 'asset://bundle/';
}

export function normalizedPivotGroupName() {
  return 'ZONE asset centered pivot';
}

export function normalizedOrientationGroupName() {
  return 'ZONE asset orientation';
}

export function maxAssetRotationDegrees() {
  return 360;
}

// The browser is not a remote-resource proxy. Bundle references can only reach
// immutable, validated members of this exact upload, or embedded image/buffer data.
export function resolveAssetMember(request, entry = '') {
  if (typeof request !== 'string' || request.length > 2048 || /[\u0000-\u001f\\]/.test(request)) throw Error('Unsafe asset resource path');
  let path = request;
  if (path.startsWith('asset://bundle/')) path = path.slice(15);
  else {
    if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('/') || path.startsWith('//')) throw Error('External asset resources are not permitted');
    const directory = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
    path = directory + path;
  }
  if (/[?#]/.test(path)) throw Error('Asset members cannot contain query or fragment parts');
  try { path = decodeURIComponent(path); } catch { throw Error('Invalid encoded asset path'); }
  if (/[\u0000-\u001f\\]/.test(path) || path.startsWith('/') || path.includes(':')) throw Error('Unsafe asset resource path');
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) throw Error('Asset path leaves its bundle'); parts.pop(); }
    else parts.push(part);
  }
  if (!parts.length) throw Error('Empty asset resource path');
  return parts.join('/');
}

export function validateAssetManifest(asset, id) {
  if (!HASH.test(String(id)) || !asset || asset.id !== id) throw Error('Asset identity does not match the requested upload');
  if (asset.status !== 'ready') throw Error(asset.error || 'This asset is still being inspected');
  if (!Array.isArray(asset.members) || !asset.members.length || asset.members.length > 512) throw Error('Invalid asset bundle members');
  const seen = new Set(); let total = 0;
  for (const member of asset.members) {
    if (!member || resolveAssetMember(member.name) !== member.name || seen.has(member.name)) throw Error('Unsafe or duplicated asset member');
    if (!Number.isSafeInteger(member.size) || member.size < 0) throw Error('Invalid asset member size');
    total += member.size; if (total > ASSET_MAX_BYTES) throw Error('Asset bundle exceeds the supported byte budget');
    seen.add(member.name);
  }
  if (!seen.has(asset.entry)) throw Error('Asset entry is not in its immutable bundle');
  return asset;
}

export function summarizeAssetBundle(asset) {
  const members = Array.isArray(asset?.members) ? asset.members : [];
  const totalBytes = members.reduce((sum, m) => sum + (Number.isSafeInteger(m?.size) && m.size > 0 ? m.size : 0), 0);
  const entry = String(asset?.entry || '');
  const entryExtension = entry.includes('.') ? entry.split('.').at(-1).toLowerCase() : '';
  return {
    id: asset?.id || null,
    status: asset?.status || 'unknown',
    kind: asset?.kind || 'unknown',
    memberCount: members.length,
    totalBytes,
    entry,
    entryExtension,
  };
}

export function validateAssetTransform(value = {}) {
  const number = (value, fallback, low, high) => Number.isFinite(Number(value)) ? Math.max(low, Math.min(high, Number(value))) : fallback;
  const vector = (value, limit) => [0, 1, 2].map(index => number(Array.isArray(value) ? value[index] : 0, 0, -limit, limit));
  return { scale: number(value.scale, 1, .000001, 10000), rotation: vector(value.rotation, 360),
    floorOffset: number(value.floorOffset, 0, -10000, 10000), cameraTarget: vector(value.cameraTarget, 10000) };
}

export function measureAssetObject(root) {
  root.updateWorldMatrix(true, true);
  let triangles = 0, meshes = 0;
  root.traverse(object => { if (object.isMesh && object.geometry?.attributes?.position) {
    meshes++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
  } });
  const box = new THREE.Box3().setFromObject(root, true);
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw Error('The asset has no finite visible geometry');
  return { bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray(), center: box.getCenter(new THREE.Vector3()).toArray() }, triangles, meshes };
}

// Rotation is authored in degrees. Centering/flooring is computed after that
// rotation, so tilted/offset author exports cannot orbit a distant world pivot.
export function normalizeAssetObject(source, transform = {}, targetSize = 2) {
  const settings = validateAssetTransform(transform), pivot = new THREE.Group(), orientation = new THREE.Group();
  pivot.name = 'ZONE asset centered pivot'; orientation.name = 'ZONE asset orientation';
  orientation.rotation.set(...settings.rotation.map(THREE.MathUtils.degToRad)); orientation.add(source); pivot.add(orientation);
  const measurement = measureAssetObject(pivot), bounds = measurement.bounds;
  const factor = targetSize / Math.max(...bounds.size, .00001) * settings.scale;
  orientation.scale.setScalar(factor);
  orientation.position.set(-bounds.center[0] * factor, -bounds.min[1] * factor + settings.floorOffset, -bounds.center[2] * factor);
  pivot.updateMatrixWorld(true);
  pivot.userData.zoneAssetTransform = settings;
  pivot.userData.zoneAssetMeasurement = measurement;
  return pivot;
}

function disposeObject(root) {
  const geometry = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  root?.traverse(object => {
    if (object.geometry) geometry.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => { texture.image?.close?.(); texture.dispose(); });
  materials.forEach(material => material.dispose()); geometry.forEach(item => item.dispose()); skeletons.forEach(item => item.dispose());
}

function decodeBase64(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(ASSET_CHUNK_BYTES / 3) * 4 + 8 || !/^[a-z\d+/]*={0,2}$/i.test(value)) throw Error('Invalid asset content chunk');
  const binary = atob(value); return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function fetchAssetMember(assetId, member, { fetcher = globalThis.fetch, signal, onProgress, baseURL = '/api/v1/assets/', draft = false } = {}) {
  const chunks = []; let offset = 0, expected = member.size;
  do {
    const url = `${baseURL}${assetId}/content?member=${encodeURIComponent(member.name)}&offset=${offset}&length=${ASSET_CHUNK_BYTES}${draft ? '&draft=1' : ''}`;
    const response = await fetcher(url, { credentials: 'same-origin', signal, cache: 'no-store' });
    if (!response.ok) throw Error(`Asset download failed (${response.status})`);
    const packet = await response.json();
    if (packet.member !== member.name || packet.offset !== offset || packet.total !== expected) throw Error('Asset content changed during transfer');
    const bytes = decodeBase64(packet.base64);
    if ((!bytes.length && offset < expected) || bytes.length > ASSET_CHUNK_BYTES || offset + bytes.length > expected) throw Error('Incomplete asset content chunk');
    chunks.push(bytes); offset += bytes.length; onProgress?.({ member: member.name, loaded: offset, total: expected });
  } while (offset < expected);
  const bytes = new Uint8Array(expected); let cursor = 0;
  for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
  return bytes;
}

export async function loadAsset(id, { onProgress, signal, fetcher = globalThis.fetch, baseURL = '/api/v1/assets/', draft = false } = {}) {
  if (!HASH.test(String(id))) throw Error('Invalid uploaded asset id');
  const response = await fetcher(baseURL + id + (draft ? '?draft=1' : ''), { credentials: 'same-origin', signal, cache: 'no-store' });
  if (!response.ok) throw Error(`Asset metadata unavailable (${response.status})`);
  const packet = await response.json(), asset = validateAssetManifest(packet.asset || packet, id);
  const buffers = new Map(), urls = new Map(); let disposed = false, object = null;
  const pending = asset.members.slice();
  const revoke = () => { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); buffers.clear(); };
  const dispose = () => { if (disposed) return; disposed = true; disposeObject(object); revoke(); };
  try {
    // At most three chunk streams, never hundreds of parallel requests for a ZIP.
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (pending.length) {
        const member = pending.shift(), bytes = await fetchAssetMember(id, member, { fetcher, signal, onProgress, baseURL, draft });
        buffers.set(member.name, bytes);
        urls.set(member.name, URL.createObjectURL(new Blob([bytes], { type: member.mime || 'application/octet-stream' })));
      }
    }));
    signal?.throwIfAborted();
    const entry = asset.entry, extension = entry.split('.').at(-1).toLowerCase();
    const result = { asset, kind: asset.kind, object: null, animations: [], url: urls.get(entry), dispose,
      transform: validateAssetTransform(asset.transform), bounds: asset.metadata?.bounds || null };
    if (!MODEL_EXTENSIONS.has(extension)) {
      if (!['png', 'jpg', 'jpeg', 'webp', 'mp3'].includes(extension)) throw Error('No browser viewer for this asset format');
      return result;
    }
    const manager = new THREE.LoadingManager();
    const known = new Set(urls.values());
    manager.setURLModifier(url => {
      if (known.has(url)) return url;
      if (url.startsWith('data:')) { if (!EMBEDDED.test(url)) throw Error('Unsupported embedded asset resource'); return url; }
      const name = resolveAssetMember(url, entry);
      if (!urls.has(name)) throw Error('Missing bundled resource: ' + name);
      return urls.get(name);
    });
    const bytes = buffers.get(entry), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const directory = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
    let resourcesStarted = 0, resourcesFailed = null;
    const loaded = new Promise((resolve, reject) => {
      manager.onStart = () => resourcesStarted++;
      manager.onLoad = resolve;
      manager.onError = url => { resourcesFailed = Error('Bundled resource failed to decode: ' + String(url).slice(0, 120)); reject(resourcesFailed); };
    });
    // Rejected texture loading remains observed even if the parser itself fails.
    loaded.catch(() => {});
    if (extension === 'glb' || extension === 'gltf') {
      const parsed = await new GLTFLoader(manager).parseAsync(extension === 'glb' ? buffer : new TextDecoder().decode(bytes), 'asset://bundle/' + directory);
      object = parsed.scene; result.animations = parsed.animations || [];
    } else if (extension === 'fbx') {
      object = new FBXLoader(manager).parse(buffer, 'asset://bundle/' + directory); result.animations = object.animations || [];
    } else {
      const text = new TextDecoder().decode(bytes), materials = [...text.matchAll(/^mtllib\s+(.+)$/gm)].map(match => match[1].trim());
      const parser = new OBJLoader(manager);
      if (materials.length > 1) throw Error('OBJ bundles must use one merged material library');
      if (materials.length) {
        const name = resolveAssetMember(materials[0], entry), data = buffers.get(name);
        if (!data) throw Error('Missing bundled OBJ material library');
        const materialDir = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
        const material = new MTLLoader(manager).parse(new TextDecoder().decode(data), 'asset://bundle/' + materialDir);
        material.preload(); parser.setMaterials(material);
      }
      object = parser.parse(text);
    }
    if (resourcesStarted) await loaded;
    if (resourcesFailed) throw resourcesFailed;
    signal?.throwIfAborted();
    const measured = measureAssetObject(object);
    object.userData.zoneUploadedAsset = { id, entry, ...measured };
    result.object = object; result.bounds = measured.bounds; result.measurement = measured;
    return result;
  } catch (error) { dispose(); throw error; }
}
