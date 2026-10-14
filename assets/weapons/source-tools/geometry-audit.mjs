import { readFileSync } from 'node:fs';
import * as THREE from '../../../lib/three184/three.module.js';
import { GLTFLoader } from '../../../lib/three184/GLTFLoader.js';

export async function geometryGlb(path) {
  // Preserve source geometry, world transforms, hierarchy and skin data. Only
  // browser image/material decoding is omitted for independent CPU checks.
  const bytes = readFileSync(path), length = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  delete data.materials; delete data.textures; delete data.images; delete data.samplers;
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const json = Buffer.from(JSON.stringify(data)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const tail = bytes.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.write('glTF'); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

export function orientObject(object, rotation = [0, 0, 0]) {
  const group = new THREE.Group(); group.rotation.set(...rotation); group.add(object); group.updateMatrixWorld(true); return group;
}

export function actualBounds(object) {
  const rows = []; object.updateMatrixWorld(true);
  object.traverse(mesh => { if (mesh.isMesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    rows.push({ name: mesh.name, triangles: (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3,
      min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() });
  } });
  return rows;
}

export function sideSurfaces(object, x, y, distance = 100) {
  return [-1, 1].map(side => {
    const hit = new THREE.Raycaster(new THREE.Vector3(x, y, side * distance), new THREE.Vector3(0, 0, -side)).intersectObject(object, true)[0];
    return hit ? { z: hit.point.z, mesh: hit.object.name } : null;
  });
}
