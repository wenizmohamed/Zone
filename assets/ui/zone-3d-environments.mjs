/* ==========================================================================
 * ZONE v157 - ARCHITECTURAL 3D STAGE ENVIRONMENTS, LIGHTING, PROPS & SKYLINE
 * Exclusive Ownership: @env-3d-world (assets/ui/zone-3d-environments.mjs)
 * Local Vendored Three.js r184 ONLY - ZERO External CDNs
 * Budget: <= 28 draw calls per stage (merged BufferGeometry + InstancedMesh)
 * Mobile LOD: <= 640px viewport simplifies segments & secondary skyline props
 * ========================================================================== */

import * as DEFAULT_THREE from '../../lib/three184/three.module.js';

export const ENV_STAGE_KINDS = Object.freeze([
  'safehouse-empire',
  'heist-breach',
  'combat-arena',
  'gym-ironpit',
  'casino-royale',
  'city-wheels-race',
  'character-turntable',
]);

export const MAX_ENV_DRAW_CALLS = 28;

const ERA_ACCENT_PALETTE = Object.freeze([
  0x94a3b8, // Era 1: Steel Harbor
  0x38bdf8, // Era 2: Neon Cyan
  0x22c55e, // Era 3: Syndicate Emerald
  0xa855f7, // Era 4: Velvet Violet
  0xf59e0b, // Era 5: Amber Cartel
  0xfbbf24, // Era 6: Sovereign Gold
]);

const ERA_TRIM_PALETTE = Object.freeze([
  0x475569,
  0x0284c7,
  0x15803d,
  0x7e22ce,
  0xd97706,
  0xeab308,
]);

function resolveViewportWidth(opts = {}) {
  if (typeof opts.viewportWidth === 'number' && Number.isFinite(opts.viewportWidth)) {
    return opts.viewportWidth;
  }
  if (typeof globalThis !== 'undefined' && globalThis.window && typeof globalThis.window.innerWidth === 'number') {
    return globalThis.window.innerWidth;
  }
  return 1280;
}

function resolveIsMobile(opts = {}) {
  if (typeof opts.isMobile === 'boolean') return opts.isMobile;
  return resolveViewportWidth(opts) <= 640;
}

function resolveReducedMotion(opts = {}) {
  if (typeof opts.reducedMotion === 'boolean') return opts.reducedMotion;
  if (typeof globalThis !== 'undefined' && globalThis.document && globalThis.document.documentElement) {
    const ds = globalThis.document.documentElement.dataset;
    if (ds && ds.zoneReducedMotion === 'true') return true;
  }
  return false;
}

/* --------------------------------------------------------------------------
 * GEOMETRY MERGING UTILITY (Normalized to position, normal, uv)
 * Combines multiple static primitive geometries into 1 draw call.
 * -------------------------------------------------------------------------- */
function normalizeToNonIndexed(T, srcGeo) {
  const geo = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  const posAttr = geo.getAttribute('position');
  const count = posAttr ? posAttr.count : 0;
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }
  if (!geo.getAttribute('uv')) {
    const uvs = new Float32Array(count * 2);
    geo.setAttribute('uv', new T.BufferAttribute(uvs, 2));
  }
  return geo;
}

function mergeGeometrySpecs(T, specs) {
  const normalized = [];
  let totalVerts = 0;
  const mat4 = new T.Matrix4();
  const pos = new T.Vector3();
  const quat = new T.Quaternion();
  const euler = new T.Euler();
  const scl = new T.Vector3();

  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    if (!sp || !sp.geo) continue;
    const g = normalizeToNonIndexed(T, sp.geo);
    sp.geo.dispose();

    pos.set(sp.x || 0, sp.y || 0, sp.z || 0);
    euler.set(sp.rx || 0, sp.ry || 0, sp.rz || 0, 'XYZ');
    quat.setFromEuler(euler);
    scl.set(sp.sx !== undefined ? sp.sx : 1, sp.sy !== undefined ? sp.sy : 1, sp.sz !== undefined ? sp.sz : 1);
    mat4.compose(pos, quat, scl);
    g.applyMatrix4(mat4);

    const pAttr = g.getAttribute('position');
    if (pAttr && pAttr.count > 0) {
      normalized.push(g);
      totalVerts += pAttr.count;
    } else {
      g.dispose();
    }
  }

  const merged = new T.BufferGeometry();
  if (totalVerts === 0) {
    merged.setAttribute('position', new T.BufferAttribute(new Float32Array(0), 3));
    merged.setAttribute('normal', new T.BufferAttribute(new Float32Array(0), 3));
    merged.setAttribute('uv', new T.BufferAttribute(new Float32Array(0), 2));
    return merged;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  let offset3 = 0;
  let offset2 = 0;
  for (let i = 0; i < normalized.length; i++) {
    const g = normalized[i];
    const pArr = g.getAttribute('position').array;
    const nArr = g.getAttribute('normal').array;
    const uArr = g.getAttribute('uv').array;

    positions.set(pArr, offset3);
    normals.set(nArr, offset3);
    uvs.set(uArr, offset2);

    offset3 += pArr.length;
    offset2 += uArr.length;
    g.dispose();
  }

  merged.setAttribute('position', new T.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new T.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new T.BufferAttribute(uvs, 2));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function buildInstancedTransforms(T, geo, mat, transforms, colors = null) {
  const mesh = new T.InstancedMesh(geo, mat, transforms.length);
  const dummy = new T.Object3D();
  for (let i = 0; i < transforms.length; i++) {
    const tr = transforms[i];
    dummy.position.set(tr.x || 0, tr.y || 0, tr.z || 0);
    dummy.rotation.set(tr.rx || 0, tr.ry || 0, tr.rz || 0);
    dummy.scale.set(tr.sx !== undefined ? tr.sx : 1, tr.sy !== undefined ? tr.sy : 1, tr.sz !== undefined ? tr.sz : 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors && colors[i] !== undefined) {
      mesh.setColorAt(i, new T.Color(colors[i]));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function makeEnvMat(T, color, roughness = 0.48, metalness = 0.55, extra = null) {
  const params = Object.assign({ color, roughness, metalness }, extra || {});
  return new T.MeshStandardMaterial(params);
}

function makeFloorOverlayMat(T, color, roughness = 0.25, metalness = 0.72, extra = null) {
  return new T.MeshStandardMaterial(Object.assign({
    color,
    roughness,
    metalness,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }, extra || {}));
}

function finalizeAndCountDrawCalls(root) {
  let calls = 0;
  root.traverse((obj) => {
    if (obj && obj.geometry) {
      if (!obj.geometry.boundingSphere && typeof obj.geometry.computeBoundingSphere === 'function') {
        obj.geometry.computeBoundingSphere();
      }
      if (!obj.geometry.boundingBox && typeof obj.geometry.computeBoundingBox === 'function') {
        obj.geometry.computeBoundingBox();
      }
    }
    if (obj && obj.visible !== false && (obj.isMesh || obj.isInstancedMesh || obj.isLine || obj.isPoints)) {
      calls++;
    }
  });
  return calls;
}

/* --------------------------------------------------------------------------
 * STAGE 1: SAFEHOUSE-EMPIRE (Pier 4 Docks, Containers, Crane, Bollards, Sign)
 * -------------------------------------------------------------------------- */
function buildSafehouseEmpire(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Wet Pier 4 Dock Planks & Mooring Border (polygonOffset prevents z-fighting)
  const dockDeckGeo = new T.RingGeometry(2.65, 4.35, isMobile ? 20 : 36);
  dockDeckGeo.rotateX(-Math.PI / 2);
  const dockDeck = new T.Mesh(
    dockDeckGeo,
    makeFloorOverlayMat(T, 0x1e242b, 0.18, 0.65)
  );
  dockDeck.position.y = 0.005;
  dockDeck.receiveShadow = true;
  group.add(dockDeck);

  // 2. Corrugated Shipping Container Walls (Left & Right Flanks, merged w/ ribs)
  const containerSpecs = [];
  const addContainer = (cx, cy, cz, ry, w, h, d, ribs) => {
    containerSpecs.push({ geo: new T.BoxGeometry(w, h, d), x: cx, y: cy, z: cz, ry });
    // Top & bottom structural corner rails
    containerSpecs.push({ geo: new T.BoxGeometry(w + 0.06, 0.07, d + 0.06), x: cx, y: cy + h * 0.5 - 0.03, z: cz, ry });
    containerSpecs.push({ geo: new T.BoxGeometry(w + 0.06, 0.07, d + 0.06), x: cx, y: cy - h * 0.5 + 0.03, z: cz, ry });
    // Corrugation ribs along facing side
    const ribCount = isMobile ? Math.max(3, Math.floor(ribs / 2)) : ribs;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    for (let r = 0; r < ribCount; r++) {
      const localX = -w * 0.44 + (r / Math.max(1, ribCount - 1)) * (w * 0.88);
      const localZ = d * 0.5 + 0.025;
      const wx = cx + localX * cos + localZ * sin;
      const wz = cz - localX * sin + localZ * cos;
      containerSpecs.push({ geo: new T.BoxGeometry(0.055, h - 0.14, 0.05), x: wx, y: cy, z: wz, ry });
    }
  };
  addContainer(-3.35, 0.62, -2.05, 0.58, 2.05, 1.24, 0.92, 9);
  addContainer(3.38, 0.62, -1.95, -0.62, 2.05, 1.24, 0.92, 9);
  if (!isMobile) {
    // Stacked upper container on left flank
    addContainer(-3.45, 1.72, -2.25, 0.48, 1.85, 1.0, 0.86, 6);
  }
  const containerMesh = new T.Mesh(
    mergeGeometrySpecs(T, containerSpecs),
    makeEnvMat(T, 0x334155, 0.55, 0.48)
  );
  containerMesh.castShadow = true;
  containerMesh.receiveShadow = true;
  group.add(containerMesh);

  // 3. Harbor Gantry Crane Silhouette (Rear-left backdrop + animated hook cable)
  const craneStaticSpecs = [
    { geo: new T.BoxGeometry(0.24, 3.6, 0.24), x: -3.25, y: 1.8, z: -3.45 },
    { geo: new T.BoxGeometry(0.24, 3.6, 0.24), x: -2.45, y: 1.8, z: -3.75 },
    { geo: new T.BoxGeometry(1.15, 0.16, 0.55), x: -2.85, y: 2.85, z: -3.6 },
    { geo: new T.BoxGeometry(3.35, 0.22, 0.26), x: -1.75, y: 3.55, z: -3.45, rz: 0.18, ry: -0.22 },
    { geo: new T.BoxGeometry(0.95, 0.45, 0.45), x: -3.45, y: 3.32, z: -3.72, ry: -0.22 },
  ];
  const craneStatic = new T.Mesh(
    mergeGeometrySpecs(T, craneStaticSpecs),
    makeEnvMat(T, 0x1e293b, 0.42, 0.78)
  );
  group.add(craneStatic);

  const craneHookPivot = new T.Group();
  craneHookPivot.position.set(-0.55, 3.65, -3.2);
  const cableSpecs = [
    { geo: new T.CylinderGeometry(0.015, 0.015, 1.35, 6), x: 0, y: -0.68, z: 0 },
    { geo: new T.BoxGeometry(0.22, 0.14, 0.14), x: 0, y: -1.38, z: 0 },
  ];
  const craneHook = new T.Mesh(mergeGeometrySpecs(T, cableSpecs), makeEnvMat(T, 0xf59e0b, 0.35, 0.8));
  craneHookPivot.add(craneHook);
  group.add(craneHookPivot);

  // 4. Wet Dock Bollards (InstancedMesh along pier perimeter)
  const bollardSpecs = [
    { geo: new T.CylinderGeometry(0.16, 0.18, 0.08, isMobile ? 8 : 12), x: 0, y: 0.04, z: 0 },
    { geo: new T.CylinderGeometry(0.085, 0.105, 0.36, isMobile ? 8 : 12), x: 0, y: 0.22, z: 0 },
    { geo: new T.CylinderGeometry(0.125, 0.11, 0.07, isMobile ? 8 : 12), x: 0, y: 0.41, z: 0 },
  ];
  const bollardGeo = mergeGeometrySpecs(T, bollardSpecs);
  const bollardAngles = isMobile ? [-2.35, -1.55, 1.55, 2.35] : [-2.55, -2.05, -1.45, 1.45, 2.05, 2.55];
  const bollardTransforms = bollardAngles.map((a) => ({
    x: Math.sin(a) * 3.85,
    y: 0,
    z: Math.cos(a) * 3.85,
  }));
  const bollards = buildInstancedTransforms(T, bollardGeo, makeEnvMat(T, 0x475569, 0.28, 0.82), bollardTransforms);
  group.add(bollards);

  // 5. Neon Syndicate Sign (Mounted above right-rear container, era-reactive emissive)
  const signFrameSpecs = [
    { geo: new T.BoxGeometry(1.72, 0.56, 0.08), x: 0, y: 0, z: 0 },
    { geo: new T.BoxGeometry(0.08, 0.55, 0.08), x: -0.58, y: -0.52, z: 0 },
    { geo: new T.BoxGeometry(0.08, 0.55, 0.08), x: 0.58, y: -0.52, z: 0 },
  ];
  const signFrame = new T.Mesh(mergeGeometrySpecs(T, signFrameSpecs), makeEnvMat(T, 0x0f172a, 0.3, 0.88));
  signFrame.position.set(2.95, 1.62, -2.18);
  signFrame.rotation.y = -0.58;
  group.add(signFrame);

  const neonBarsSpecs = [
    { geo: new T.BoxGeometry(1.48, 0.06, 0.04), x: 0, y: 0.18, z: 0.04 },
    { geo: new T.BoxGeometry(1.48, 0.06, 0.04), x: 0, y: -0.18, z: 0.04 },
    { geo: new T.BoxGeometry(1.18, 0.11, 0.05), x: 0, y: 0.03, z: 0.04 },
    { geo: new T.BoxGeometry(0.74, 0.07, 0.05), x: 0, y: -0.09, z: 0.04 },
  ];
  const neonMat = makeEnvMat(T, accent, 0.12, 0.2, { emissive: accent, emissiveIntensity: 1.15 });
  registerEraMat(neonMat, 'accent');
  const neonSign = new T.Mesh(mergeGeometrySpecs(T, neonBarsSpecs), neonMat);
  neonSign.position.copy(signFrame.position);
  neonSign.rotation.copy(signFrame.rotation);
  group.add(neonSign);

  // 6. Tactical Briefing Table & Crates Cluster (Perimeter corners, zero actor overlap)
  const crateSpecs = [
    // Right front pier corner tactical table + stacked supply crates
    { geo: new T.BoxGeometry(0.95, 0.08, 0.58), x: 3.12, y: 0.52, z: 0.92, ry: -0.42 },
    { geo: new T.BoxGeometry(0.08, 0.5, 0.08), x: 2.84, y: 0.25, z: 1.05, ry: -0.42 },
    { geo: new T.BoxGeometry(0.08, 0.5, 0.08), x: 3.4, y: 0.25, z: 0.79, ry: -0.42 },
    { geo: new T.BoxGeometry(0.56, 0.44, 0.52), x: -3.22, y: 0.22, z: 0.85, ry: 0.38 },
    { geo: new T.BoxGeometry(0.42, 0.36, 0.42), x: -3.15, y: 0.62, z: 0.78, ry: 0.65 },
  ];
  const cratesMesh = new T.Mesh(mergeGeometrySpecs(T, crateSpecs), makeEnvMat(T, 0x3f3f46, 0.58, 0.35));
  cratesMesh.castShadow = true;
  cratesMesh.receiveShadow = true;
  group.add(cratesMesh);

  // Era-reactive tactical map hologram strip on briefing table
  const holoMat = makeEnvMat(T, accent, 0.1, 0.2, { emissive: accent, emissiveIntensity: 0.85, transparent: true, opacity: 0.82 });
  registerEraMat(holoMat, 'accent');
  const mapSlate = new T.Mesh(new T.BoxGeometry(0.68, 0.03, 0.36), holoMat);
  mapSlate.position.set(3.12, 0.57, 0.92);
  mapSlate.rotation.y = -0.42;
  group.add(mapSlate);

  // 7. Era-reactive harbor beacon light
  const beaconMat = makeEnvMat(T, accent, 0.15, 0.3, { emissive: accent, emissiveIntensity: 1.0 });
  registerEraMat(beaconMat, 'accent');
  const harborBeacon = new T.Mesh(new T.SphereGeometry(0.09, isMobile ? 8 : 12, 8), beaconMat);
  harborBeacon.position.set(-2.85, 3.65, -3.6);
  group.add(harborBeacon);

  registerUpdater((elapsed) => {
    craneHookPivot.rotation.z = Math.sin(elapsed * 0.9) * 0.045;
    craneHookPivot.rotation.x = Math.cos(elapsed * 0.65) * 0.025;
    const pulse = 0.95 + 0.22 * Math.sin(elapsed * 3.1) + (Math.sin(elapsed * 17.0) > 0.96 ? -0.35 : 0);
    neonMat.emissiveIntensity = Math.max(0.4, pulse);
    beaconMat.emissiveIntensity = 0.7 + 0.5 * Math.sin(elapsed * 2.4);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 2: HEIST-BREACH (Vault Arch, Deposit Boxes, Server Racks, CCTV Pods)
 * -------------------------------------------------------------------------- */
function buildHeistBreach(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Vault Floor Threshold Inlay (polygonOffset prevents z-fighting)
  const floorInlayGeo = new T.RingGeometry(2.15, 4.15, isMobile ? 16 : 32);
  floorInlayGeo.rotateX(-Math.PI / 2);
  const floorInlay = new T.Mesh(floorInlayGeo, makeFloorOverlayMat(T, 0x1e293b, 0.22, 0.8));
  floorInlay.position.y = 0.005;
  group.add(floorInlay);

  // 2. Reinforced Bank Vault Chamber Arch framing rear vault door (z = -2.1)
  const archSpecs = [];
  const archSegs = isMobile ? 5 : 9;
  for (let i = 0; i < archSegs; i++) {
    const t = i / (archSegs - 1);
    const ang = t * Math.PI;
    const rad = 2.45;
    archSpecs.push({
      geo: new T.BoxGeometry(0.46, 0.75, 0.52),
      x: Math.cos(ang) * rad,
      y: 0.55 + Math.sin(ang) * (rad * 0.88),
      z: -2.15,
      rz: ang - Math.PI / 2,
    });
  }
  // Vertical armored blast jambs
  archSpecs.push({ geo: new T.BoxGeometry(0.55, 1.4, 0.72), x: -2.45, y: 0.7, z: -2.05 });
  archSpecs.push({ geo: new T.BoxGeometry(0.55, 1.4, 0.72), x: 2.45, y: 0.7, z: -2.05 });
  const vaultArch = new T.Mesh(mergeGeometrySpecs(T, archSpecs), makeEnvMat(T, 0x334155, 0.34, 0.85));
  vaultArch.castShadow = true;
  group.add(vaultArch);

  // Vault arch trim strip
  const archTrimMat = makeEnvMat(T, 0xef4444, 0.16, 0.4, { emissive: 0xef4444, emissiveIntensity: 0.85 });
  registerEraMat(archTrimMat, 'trim');
  const archTrim = new T.Mesh(
    new T.TorusGeometry(2.15, 0.04, 6, isMobile ? 14 : 24, Math.PI),
    archTrimMat
  );
  archTrim.position.set(0, 0.55, -1.88);
  group.add(archTrim);

  // 3. Brushed Steel Deposit-Box Wall Grid (InstancedMesh on left/right walls)
  const boxGeo = new T.BoxGeometry(0.36, 0.24, 0.16);
  const boxMat = makeEnvMat(T, 0x94a3b8, 0.24, 0.92);
  const boxTransforms = [];
  const cols = isMobile ? 3 : 4;
  const rows = isMobile ? 3 : 4;
  for (const side of [-1, 1]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ang = (0.35 + c * 0.22) * side;
        const rad = 3.65;
        boxTransforms.push({
          x: Math.sin(ang) * rad,
          y: 0.42 + r * 0.32,
          z: -Math.cos(ang) * rad + 0.65,
          ry: -ang,
        });
      }
    }
  }
  const depositGrid = buildInstancedTransforms(T, boxGeo, boxMat, boxTransforms);
  group.add(depositGrid);

  // 4. Server Racks + Blinking Emissive LEDs (InstancedMesh)
  const rackSpecs = [];
  const rackPositions = [
    { x: -3.15, z: -1.4, ry: 0.52 },
    { x: 3.15, z: -1.4, ry: -0.52 },
    ...(isMobile ? [] : [{ x: -3.45, z: 0.2, ry: 1.05 }]),
  ];
  const ledTransforms = [];
  const ledColors = [];
  const palette = [0x22d3ee, 0x22c55e, 0xef4444, accent];

  for (let i = 0; i < rackPositions.length; i++) {
    const rp = rackPositions[i];
    rackSpecs.push({ geo: new T.BoxGeometry(0.72, 1.75, 0.54), x: rp.x, y: 0.875, z: rp.z, ry: rp.ry });
    const cos = Math.cos(rp.ry);
    const sin = Math.sin(rp.ry);
    const ledRows = isMobile ? 4 : 6;
    for (let l = 0; l < ledRows; l++) {
      const lx = (l % 2 === 0 ? -0.18 : 0.14);
      const lz = 0.285;
      ledTransforms.push({
        x: rp.x + lx * cos + lz * sin,
        y: 0.38 + l * 0.2,
        z: rp.z - lx * sin + lz * cos,
        ry: rp.ry,
      });
      ledColors.push(palette[(i + l) % palette.length]);
    }
  }
  const racksMesh = new T.Mesh(mergeGeometrySpecs(T, rackSpecs), makeEnvMat(T, 0x0f172a, 0.42, 0.72));
  group.add(racksMesh);

  const ledGeo = new T.BoxGeometry(0.14, 0.04, 0.03);
  const ledMat = new T.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });
  const serverLeds = buildInstancedTransforms(T, ledGeo, ledMat, ledTransforms, ledColors);
  group.add(serverLeds);

  // 5. Security Camera Pods (2 articulated CCTV heads sweeping left-right)
  const podMountSpecs = [
    { geo: new T.BoxGeometry(0.14, 0.14, 0.35), x: -2.65, y: 2.45, z: -1.65, ry: 0.4 },
    { geo: new T.BoxGeometry(0.14, 0.14, 0.35), x: 2.65, y: 2.45, z: -1.65, ry: -0.4 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, podMountSpecs), makeEnvMat(T, 0x334155, 0.35, 0.8)));

  const camHeads = [];
  const camBodyGeo = mergeGeometrySpecs(T, [
    { geo: new T.BoxGeometry(0.18, 0.14, 0.34), x: 0, y: 0, z: 0.1 },
    { geo: new T.CylinderGeometry(0.06, 0.07, 0.08, 8), x: 0, y: 0, z: 0.28, rx: Math.PI / 2 },
  ]);
  const camBodyMat = makeEnvMat(T, 0xe2e8f0, 0.3, 0.65);
  for (const sx of [-2.65, 2.65]) {
    const camHead = new T.Mesh(camBodyGeo, camBodyMat);
    camHead.position.set(sx, 2.38, -1.52);
    camHead.rotation.x = 0.35;
    group.add(camHead);
    camHeads.push({ mesh: camHead, baseYaw: sx < 0 ? 0.45 : -0.45, phase: sx < 0 ? 0 : Math.PI });
  }

  registerUpdater((elapsed) => {
    for (let i = 0; i < camHeads.length; i++) {
      const ch = camHeads[i];
      ch.mesh.rotation.y = ch.baseYaw + Math.sin(elapsed * 1.15 + ch.phase) * 0.42;
    }
    ledMat.emissiveIntensity = 0.65 + 0.55 * Math.abs(Math.sin(elapsed * 4.2));
    archTrimMat.emissiveIntensity = 0.55 + 0.45 * Math.sin(elapsed * 2.6);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 3: COMBAT-ARENA (Rooftop Parapet, Skyline, Water Tower, HVAC, Fence, Puddle)
 * -------------------------------------------------------------------------- */
function buildCombatArena(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Wet Neon Puddle Plane (polygonOffset prevents z-fighting with floor)
  const puddleGeo = new T.CircleGeometry(1.95, isMobile ? 16 : 28);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = makeFloorOverlayMat(T, 0x0f172a, 0.05, 0.94, {
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.86,
  });
  registerEraMat(puddleMat, 'accent', 0.22);
  const puddle = new T.Mesh(puddleGeo, puddleMat);
  puddle.position.set(-0.25, 0.006, 0.35);
  puddle.scale.set(1.35, 1, 0.82);
  group.add(puddle);

  // 2. Urban Rooftop Parapet Wall (segmented concrete arc framing back & flanks)
  const parapetSpecs = [];
  const segCount = isMobile ? 7 : 11;
  for (let i = 0; i < segCount; i++) {
    const t = i / (segCount - 1);
    const ang = -Math.PI * 0.78 + t * (Math.PI * 1.56);
    const rad = 4.02;
    const wx = Math.sin(ang) * rad;
    const wz = -Math.cos(ang) * rad;
    parapetSpecs.push({ geo: new T.BoxGeometry(1.25, 0.62, 0.26), x: wx, y: 0.31, z: wz, ry: -ang });
    parapetSpecs.push({ geo: new T.BoxGeometry(1.32, 0.09, 0.34), x: wx, y: 0.64, z: wz, ry: -ang });
  }
  const parapet = new T.Mesh(mergeGeometrySpecs(T, parapetSpecs), makeEnvMat(T, 0x27272a, 0.72, 0.22));
  parapet.receiveShadow = true;
  group.add(parapet);

  // 3. Distant Zone City Emissive Skyscraper Skyline Silhouette
  const towerGeo = new T.BoxGeometry(1, 1, 1);
  const towerMat = makeEnvMat(T, 0x0f172a, 0.45, 0.6);
  const towerData = isMobile
    ? [
        { x: -6.5, z: -8.5, sx: 1.8, sy: 6.2, sz: 1.8 },
        { x: -2.4, z: -10.2, sx: 2.1, sy: 8.6, sz: 2.0 },
        { x: 2.1, z: -9.8, sx: 1.9, sy: 7.4, sz: 1.9 },
        { x: 6.4, z: -8.2, sx: 1.7, sy: 5.8, sz: 1.7 },
      ]
    : [
        { x: -8.2, z: -7.5, sx: 1.6, sy: 5.4, sz: 1.6 },
        { x: -5.4, z: -9.5, sx: 2.0, sy: 7.8, sz: 1.9 },
        { x: -2.2, z: -11.0, sx: 2.2, sy: 9.6, sz: 2.2 },
        { x: 0.9, z: -10.4, sx: 1.8, sy: 8.1, sz: 1.8 },
        { x: 3.9, z: -9.2, sx: 2.1, sy: 7.2, sz: 2.0 },
        { x: 7.2, z: -7.8, sx: 1.7, sy: 5.9, sz: 1.7 },
      ];
  const skylineTowers = buildInstancedTransforms(
    T,
    towerGeo,
    towerMat,
    towerData.map((b) => ({ x: b.x, y: b.sy * 0.5 - 1.5, z: b.z, sx: b.sx, sy: b.sy, sz: b.sz }))
  );
  group.add(skylineTowers);

  // Emissive skyscraper window strips (InstancedMesh)
  const winStripGeo = new T.BoxGeometry(0.82, 0.08, 0.08);
  const winMat = makeEnvMat(T, accent, 0.15, 0.2, { emissive: accent, emissiveIntensity: 0.95 });
  registerEraMat(winMat, 'accent');
  const winTransforms = [];
  for (let i = 0; i < towerData.length; i++) {
    const b = towerData[i];
    const bands = isMobile ? 2 : 4;
    for (let k = 0; k < bands; k++) {
      winTransforms.push({
        x: b.x,
        y: b.sy * 0.35 + k * 0.85,
        z: b.z + b.sz * 0.5 + 0.03,
        sx: b.sx,
      });
    }
  }
  group.add(buildInstancedTransforms(T, winStripGeo, winMat, winTransforms));

  // 4. Rooftop Water Tower (Rear-left corner)
  const wtSpecs = [
    { geo: new T.CylinderGeometry(0.48, 0.52, 0.95, isMobile ? 8 : 14), x: -2.95, y: 1.85, z: -2.45 },
    { geo: new T.ConeGeometry(0.56, 0.38, isMobile ? 8 : 14), x: -2.95, y: 2.5, z: -2.45 },
    { geo: new T.CylinderGeometry(0.04, 0.05, 1.4, 6), x: -3.28, y: 0.7, z: -2.75 },
    { geo: new T.CylinderGeometry(0.04, 0.05, 1.4, 6), x: -2.62, y: 0.7, z: -2.75 },
    { geo: new T.CylinderGeometry(0.04, 0.05, 1.4, 6), x: -3.28, y: 0.7, z: -2.15 },
    { geo: new T.CylinderGeometry(0.04, 0.05, 1.4, 6), x: -2.62, y: 0.7, z: -2.15 },
  ];
  const waterTower = new T.Mesh(mergeGeometrySpecs(T, wtSpecs), makeEnvMat(T, 0x57534e, 0.65, 0.35));
  waterTower.castShadow = true;
  group.add(waterTower);

  // 5. AC HVAC Units + Spinning Exhaust Fan
  const hvacSpecs = [
    { geo: new T.BoxGeometry(0.95, 0.64, 0.72), x: 2.95, y: 0.32, z: -2.35, ry: -0.35 },
    { geo: new T.CylinderGeometry(0.24, 0.24, 0.08, 12), x: 2.95, y: 0.66, z: -2.35 },
    { geo: new T.BoxGeometry(0.76, 0.52, 0.62), x: -3.25, y: 0.26, z: 0.15, ry: 0.95 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, hvacSpecs), makeEnvMat(T, 0x64748b, 0.4, 0.72)));

  const fanRotor = new T.Mesh(
    mergeGeometrySpecs(T, [
      { geo: new T.BoxGeometry(0.4, 0.03, 0.06), x: 0, y: 0, z: 0 },
      { geo: new T.BoxGeometry(0.06, 0.03, 0.4), x: 0, y: 0, z: 0 },
    ]),
    makeEnvMat(T, 0x1e293b, 0.3, 0.8)
  );
  fanRotor.position.set(2.95, 0.71, -2.35);
  group.add(fanRotor);

  // 6. Chain-Link Corner Fence (Posts & rails + translucent wire mesh panel)
  const fenceFrameSpecs = [
    { geo: new T.CylinderGeometry(0.035, 0.035, 1.45, 6), x: 1.95, y: 0.72, z: -3.25 },
    { geo: new T.CylinderGeometry(0.035, 0.035, 1.45, 6), x: 3.35, y: 0.72, z: -1.75 },
    { geo: new T.BoxGeometry(2.05, 0.05, 0.05), x: 2.65, y: 1.42, z: -2.5, ry: -0.82 },
    { geo: new T.BoxGeometry(2.05, 0.05, 0.05), x: 2.65, y: 0.68, z: -2.5, ry: -0.82 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, fenceFrameSpecs), makeEnvMat(T, 0x94a3b8, 0.35, 0.85)));

  const fenceMeshPanel = new T.Mesh(
    new T.PlaneGeometry(1.98, 1.15),
    new T.MeshStandardMaterial({
      color: 0x64748b,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    })
  );
  fenceMeshPanel.position.set(2.65, 0.92, -2.5);
  fenceMeshPanel.rotation.y = -0.82;
  group.add(fenceMeshPanel);

  registerUpdater((elapsed, dt) => {
    fanRotor.rotation.y += dt * 7.5;
    winMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(elapsed * 1.8);
    puddleMat.emissiveIntensity = 0.14 + 0.08 * Math.sin(elapsed * 2.2);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 4: GYM-IRONPIT (Pillars, 4-Post Ring, Dumbbells, Chalk Stand, Pendants)
 * -------------------------------------------------------------------------- */
function buildGymIronpit(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Rubber Gym Mat Border Overlay (polygonOffset)
  const matRingGeo = new T.RingGeometry(2.45, 4.25, isMobile ? 16 : 32);
  matRingGeo.rotateX(-Math.PI / 2);
  const matRing = new T.Mesh(matRingGeo, makeFloorOverlayMat(T, 0x18181b, 0.78, 0.12));
  matRing.position.y = 0.005;
  group.add(matRing);

  // 2. Underground Brick & Steel I-Beam Pillars + Overhead Truss
  const pillarSpecs = [];
  const pillarCoords = [
    [-3.45, -2.15],
    [3.45, -2.15],
    [-3.65, 0.55],
    [3.65, 0.55],
  ];
  for (let i = 0; i < pillarCoords.length; i++) {
    const [px, pz] = pillarCoords[i];
    pillarSpecs.push({ geo: new T.BoxGeometry(0.42, 3.1, 0.42), x: px, y: 1.55, z: pz });
    pillarSpecs.push({ geo: new T.BoxGeometry(0.54, 0.18, 0.54), x: px, y: 0.09, z: pz });
    pillarSpecs.push({ geo: new T.BoxGeometry(0.54, 0.18, 0.54), x: px, y: 3.01, z: pz });
  }
  pillarSpecs.push({ geo: new T.BoxGeometry(7.2, 0.22, 0.28), x: 0, y: 3.05, z: -2.15 });
  const pillarsMesh = new T.Mesh(mergeGeometrySpecs(T, pillarSpecs), makeEnvMat(T, 0x451a03, 0.72, 0.25));
  pillarsMesh.castShadow = true;
  group.add(pillarsMesh);

  // 3. 4-Post Boxing Ring Corner Posts + Side Ropes (completes ring enclosure)
  const postSpecs = [
    { geo: new T.CylinderGeometry(0.075, 0.085, 1.38, isMobile ? 8 : 12), x: -2.9, y: 0.69, z: 1.55 },
    { geo: new T.CylinderGeometry(0.075, 0.085, 1.38, isMobile ? 8 : 12), x: 2.9, y: 0.69, z: 1.55 },
    { geo: new T.BoxGeometry(0.18, 0.92, 0.18), x: -2.9, y: 0.76, z: 1.55 },
    { geo: new T.BoxGeometry(0.18, 0.92, 0.18), x: 2.9, y: 0.76, z: 1.55 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, postSpecs), makeEnvMat(T, 0x334155, 0.35, 0.85)));

  const ropeSpecs = [];
  for (let tier = 0; tier < 3; tier++) {
    const ry = 0.45 + tier * 0.34;
    // Left & Right side ropes from z = -1.8 to z = 1.55 (length 3.35)
    ropeSpecs.push({ geo: new T.CylinderGeometry(0.018, 0.018, 3.35, 8), x: -2.9, y: ry, z: -0.125, rx: Math.PI / 2 });
    ropeSpecs.push({ geo: new T.CylinderGeometry(0.018, 0.018, 3.35, 8), x: 2.9, y: ry, z: -0.125, rx: Math.PI / 2 });
  }
  const sideRopes = new T.Mesh(
    mergeGeometrySpecs(T, ropeSpecs),
    makeEnvMat(T, 0xdc2626, 0.4, 0.2, { emissive: 0x7f1d1d, emissiveIntensity: 0.3 })
  );
  group.add(sideRopes);

  // 4. Dumbbell Rack + Instanced Hex Dumbbells (Front-right perimeter)
  const rackSpecs = [
    { geo: new T.BoxGeometry(0.1, 0.85, 1.25), x: 2.95, y: 0.425, z: 0.95, ry: -0.45 },
    { geo: new T.BoxGeometry(0.32, 0.06, 1.32), x: 2.9, y: 0.78, z: 0.95, ry: -0.45 },
    { geo: new T.BoxGeometry(0.32, 0.06, 1.32), x: 2.95, y: 0.42, z: 0.95, ry: -0.45 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, rackSpecs), makeEnvMat(T, 0x1e293b, 0.38, 0.82)));

  const dumbbellGeo = mergeGeometrySpecs(T, [
    { geo: new T.CylinderGeometry(0.025, 0.025, 0.26, 6), x: 0, y: 0, z: 0, rz: Math.PI / 2 },
    { geo: new T.CylinderGeometry(0.075, 0.075, 0.07, 6), x: -0.12, y: 0, z: 0, rz: Math.PI / 2 },
    { geo: new T.CylinderGeometry(0.075, 0.075, 0.07, 6), x: 0.12, y: 0, z: 0, rz: Math.PI / 2 },
  ]);
  const dbTransforms = [];
  const dbCount = isMobile ? 3 : 4;
  for (let i = 0; i < dbCount; i++) {
    const offset = (i - (dbCount - 1) / 2) * 0.28;
    dbTransforms.push({
      x: 2.86 + Math.sin(-0.45) * offset,
      y: 0.87,
      z: 0.95 + Math.cos(-0.45) * offset,
      ry: -0.45,
    });
  }
  group.add(buildInstancedTransforms(T, dumbbellGeo, makeEnvMat(T, 0x94a3b8, 0.25, 0.9), dbTransforms));

  // 5. Chalk Stand (Front-left perimeter)
  const chalkStandSpecs = [
    { geo: new T.CylinderGeometry(0.24, 0.28, 0.06, 12), x: -2.85, y: 0.03, z: 1.05 },
    { geo: new T.CylinderGeometry(0.045, 0.055, 0.88, 10), x: -2.85, y: 0.46, z: 1.05 },
    { geo: new T.CylinderGeometry(0.22, 0.14, 0.16, 12), x: -2.85, y: 0.92, z: 1.05 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, chalkStandSpecs), makeEnvMat(T, 0x334155, 0.4, 0.75)));

  const chalkMound = new T.Mesh(
    new T.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    makeEnvMat(T, 0xf8fafc, 0.92, 0.0)
  );
  chalkMound.position.set(-2.85, 0.98, 1.05);
  group.add(chalkMound);

  // 6. Warm Industrial Pendant Lights (Swaying bell shades)
  const pendantPivot = new T.Group();
  pendantPivot.position.set(0, 3.05, -1.65);
  const pendantSpecs = [];
  for (const px of [-1.55, 1.55]) {
    pendantSpecs.push({ geo: new T.CylinderGeometry(0.015, 0.015, 0.65, 6), x: px, y: -0.32, z: 0 });
    pendantSpecs.push({ geo: new T.ConeGeometry(0.28, 0.22, isMobile ? 10 : 16), x: px, y: -0.68, z: 0 });
  }
  pendantPivot.add(new T.Mesh(mergeGeometrySpecs(T, pendantSpecs), makeEnvMat(T, 0x18181b, 0.35, 0.85)));

  const bulbMat = makeEnvMat(T, accent, 0.1, 0.1, { emissive: 0xfbbf24, emissiveIntensity: 1.25 });
  registerEraMat(bulbMat, 'accent', 0.4);
  const bulbs = new T.Mesh(
    mergeGeometrySpecs(T, [
      { geo: new T.SphereGeometry(0.1, 8, 8), x: -1.55, y: -0.78, z: 0 },
      { geo: new T.SphereGeometry(0.1, 8, 8), x: 1.55, y: -0.78, z: 0 },
    ]),
    bulbMat
  );
  pendantPivot.add(bulbs);
  group.add(pendantPivot);

  registerUpdater((elapsed) => {
    pendantPivot.rotation.x = Math.sin(elapsed * 1.1) * 0.035;
    bulbMat.emissiveIntensity = 1.1 + 0.18 * Math.sin(elapsed * 3.4);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 5: CASINO-ROYALE (Monte-Carlo Arched VIP Backwall, Neon Crown, Columns, Rail, Chandelier, Chips)
 * -------------------------------------------------------------------------- */
function buildCasinoRoyale(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Emerald Felt Casino Floor Inlay (polygonOffset)
  const feltGeo = new T.RingGeometry(2.35, 4.18, isMobile ? 18 : 36);
  feltGeo.rotateX(-Math.PI / 2);
  const feltInlay = new T.Mesh(feltGeo, makeFloorOverlayMat(T, 0x064e3b, 0.82, 0.08));
  feltInlay.position.y = 0.005;
  group.add(feltInlay);

  // 2. Sculpted Monte-Carlo Arched VIP Salon Backwall (Obsidian-Mahogany Wainscoting + Grand Arch Alcove)
  const wallSpecs = [
    // Main curved/stepped VIP backwall plinth & wainscot dado
    { geo: new T.BoxGeometry(6.8, 0.58, 0.34), x: 0, y: 0.29, z: -2.95 },
    { geo: new T.BoxGeometry(6.95, 0.12, 0.42), x: 0, y: 0.62, z: -2.95 },
    // Left & Right VIP salon pilasters flanking the grand central arch
    { geo: new T.BoxGeometry(1.65, 2.35, 0.32), x: -2.42, y: 1.82, z: -2.92, ry: 0.14 },
    { geo: new T.BoxGeometry(1.65, 2.35, 0.32), x: 2.42, y: 1.82, z: -2.92, ry: -0.14 },
    // Recessed crimson-obsidian central VIP niche backdrop
    { geo: new T.BoxGeometry(3.35, 2.55, 0.18), x: 0, y: 1.92, z: -3.08 },
    // Stepped Art-Deco cornice entablature crowning the backwall
    { geo: new T.BoxGeometry(6.9, 0.24, 0.44), x: 0, y: 3.12, z: -2.92 },
    { geo: new T.BoxGeometry(4.2, 0.28, 0.48), x: 0, y: 3.36, z: -2.88 },
  ];
  if (!isMobile) {
    // Flanking curved wing alcoves on desktop
    wallSpecs.push({ geo: new T.BoxGeometry(1.25, 2.15, 0.28), x: -3.55, y: 1.72, z: -2.25, ry: 0.52 });
    wallSpecs.push({ geo: new T.BoxGeometry(1.25, 2.15, 0.28), x: 3.55, y: 1.72, z: -2.25, ry: -0.52 });
  }
  const vipBackwall = new T.Mesh(mergeGeometrySpecs(T, wallSpecs), makeEnvMat(T, 0x1c1210, 0.38, 0.52));
  vipBackwall.castShadow = true;
  vipBackwall.receiveShadow = true;
  group.add(vipBackwall);

  // 3. Champagne-Brass Art-Deco Arch Moldings & Sunburst Rays (1 merged draw call)
  const archTrimSpecs = [
    { geo: new T.TorusGeometry(1.42, 0.055, 8, isMobile ? 16 : 28, Math.PI), x: 0, y: 1.72, z: -2.86 },
    { geo: new T.BoxGeometry(0.12, 1.15, 0.12), x: -1.42, y: 1.15, z: -2.86 },
    { geo: new T.BoxGeometry(0.12, 1.15, 0.12), x: 1.42, y: 1.15, z: -2.86 },
    { geo: new T.BoxGeometry(6.85, 0.07, 0.48), x: 0, y: 3.01, z: -2.90 },
  ];
  const rayCount = isMobile ? 5 : 9;
  for (let r = 0; r < rayCount; r++) {
    const ang = (r / (rayCount - 1)) * Math.PI;
    archTrimSpecs.push({
      geo: new T.BoxGeometry(0.035, 0.72, 0.04),
      x: Math.cos(ang) * 0.82,
      y: 1.74 + Math.sin(ang) * 0.82,
      z: -2.96,
      rz: ang - Math.PI / 2,
    });
  }
  if (!isMobile) {
    archTrimSpecs.push({ geo: new T.TorusGeometry(0.52, 0.035, 6, 16, Math.PI), x: -2.42, y: 2.05, z: -2.74, ry: 0.14 });
    archTrimSpecs.push({ geo: new T.TorusGeometry(0.52, 0.035, 6, 16, Math.PI), x: 2.42, y: 2.05, z: -2.74, ry: -0.14 });
  }
  group.add(new T.Mesh(mergeGeometrySpecs(T, archTrimSpecs), makeEnvMat(T, 0xfbbf24, 0.18, 0.94)));

  // 4. Monte-Carlo Neon Crown Crest & Luminous VIP Arch Tubing (Era-reactive emissive)
  const neonCrownMat = makeEnvMat(T, accent, 0.12, 0.25, {
    emissive: 0xfbbf24,
    emissiveIntensity: 1.25,
  });
  registerEraMat(neonCrownMat, 'accent', 0.45);
  const crownSpecs = [
    // Luminous inner arch neon tube
    { geo: new T.TorusGeometry(1.32, 0.028, 6, isMobile ? 16 : 28, Math.PI), x: 0, y: 1.72, z: -2.84 },
    // Royal Monte-Carlo 5-spire crown base band & spires
    { geo: new T.BoxGeometry(0.86, 0.08, 0.08), x: 0, y: 3.36, z: -2.62 },
    { geo: new T.ConeGeometry(0.075, 0.34, 4), x: 0, y: 3.58, z: -2.62 },
    { geo: new T.ConeGeometry(0.062, 0.26, 4), x: -0.21, y: 3.53, z: -2.62, rz: 0.16 },
    { geo: new T.ConeGeometry(0.062, 0.26, 4), x: 0.21, y: 3.53, z: -2.62, rz: -0.16 },
    { geo: new T.ConeGeometry(0.052, 0.20, 4), x: -0.39, y: 3.48, z: -2.62, rz: 0.30 },
    { geo: new T.ConeGeometry(0.052, 0.20, 4), x: 0.39, y: 3.48, z: -2.62, rz: -0.30 },
    { geo: new T.OctahedronGeometry(0.06, 0), x: 0, y: 3.78, z: -2.62 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, crownSpecs), neonCrownMat));

  // 5. Art-Deco Brass Columns (4 fluted/stepped pillars)
  const colSpecs = [];
  const colPositions = [
    [-3.25, -1.85],
    [3.25, -1.85],
    [-3.65, 0.45],
    [3.65, 0.45],
  ];
  const radialSegs = isMobile ? 8 : 14;
  for (let i = 0; i < colPositions.length; i++) {
    const [cx, cz] = colPositions[i];
    colSpecs.push({ geo: new T.CylinderGeometry(0.24, 0.28, 0.24, radialSegs), x: cx, y: 0.12, z: cz });
    colSpecs.push({ geo: new T.CylinderGeometry(0.16, 0.18, 2.75, radialSegs), x: cx, y: 1.58, z: cz });
    colSpecs.push({ geo: new T.CylinderGeometry(0.3, 0.18, 0.26, radialSegs), x: cx, y: 3.02, z: cz });
  }
  const columns = new T.Mesh(mergeGeometrySpecs(T, colSpecs), makeEnvMat(T, 0xd97706, 0.22, 0.92));
  columns.castShadow = true;
  group.add(columns);

  if (!isMobile) {
    // Desktop-only warm Art-Deco column wall sconces (simplifies draw calls on <= 640px mobile LOD)
    const sconceGeo = new T.OctahedronGeometry(0.09, 0);
    const sconceTransforms = colPositions.map(([cx, cz]) => ({
      x: cx * 0.93,
      y: 2.18,
      z: cz + 0.16,
      sy: 1.45,
    }));
    group.add(buildInstancedTransforms(T, sconceGeo, neonCrownMat, sconceTransforms));
  }

  // 6. Velvet VIP Pit Rail (Instanced brass stanchions + draped crimson velvet ropes)
  const stanchionGeo = mergeGeometrySpecs(T, [
    { geo: new T.CylinderGeometry(0.12, 0.14, 0.05, 10), x: 0, y: 0.025, z: 0 },
    { geo: new T.CylinderGeometry(0.032, 0.036, 0.78, 8), x: 0, y: 0.44, z: 0 },
    { geo: new T.SphereGeometry(0.06, 8, 8), x: 0, y: 0.86, z: 0 },
  ]);
  const stanchionCount = isMobile ? 5 : 7;
  const stanchionPts = [];
  for (let i = 0; i < stanchionCount; i++) {
    const t = i / (stanchionCount - 1);
    const ang = -Math.PI * 0.7 + t * (Math.PI * 1.4);
    stanchionPts.push({
      x: Math.sin(ang) * 3.15,
      y: 0,
      z: -Math.cos(ang) * 3.15 + 0.35,
      ry: -ang,
    });
  }
  group.add(buildInstancedTransforms(T, stanchionGeo, makeEnvMat(T, 0xfbbf24, 0.18, 0.94), stanchionPts));

  // Velvet ropes connecting stanchions
  const velvetSpecs = [];
  for (let i = 0; i < stanchionPts.length - 1; i++) {
    const a = stanchionPts[i];
    const b = stanchionPts[i + 1];
    const mx = (a.x + b.x) * 0.5;
    const mz = (a.z + b.z) * 0.5;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    velvetSpecs.push({
      geo: new T.CylinderGeometry(0.026, 0.026, len, 8),
      x: mx,
      y: 0.72,
      z: mz,
      rx: Math.PI / 2,
      ry: yaw,
    });
  }
  group.add(new T.Mesh(mergeGeometrySpecs(T, velvetSpecs), makeEnvMat(T, 0x991b1b, 0.78, 0.08)));

  // 7. Warm Chandelier Glow Halo (Overhead tiered brass ring + luminous halo)
  const chandelierGroup = new T.Group();
  chandelierGroup.position.set(0, 3.08, -0.55);
  const chanFrame = new T.Mesh(
    mergeGeometrySpecs(T, [
      { geo: new T.TorusGeometry(1.15, 0.045, 8, isMobile ? 16 : 28), x: 0, y: 0, z: 0, rx: Math.PI / 2 },
      { geo: new T.TorusGeometry(0.68, 0.035, 8, isMobile ? 14 : 24), x: 0, y: -0.22, z: 0, rx: Math.PI / 2 },
      { geo: new T.CylinderGeometry(0.02, 0.02, 0.8, 6), x: 0, y: 0.35, z: 0 },
    ]),
    makeEnvMat(T, 0xfbbf24, 0.18, 0.94)
  );
  chandelierGroup.add(chanFrame);

  const haloMat = makeEnvMat(T, accent, 0.1, 0.1, {
    emissive: 0xfde68a,
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.75,
  });
  registerEraMat(haloMat, 'accent', 0.35);
  const haloRing = new T.Mesh(new T.TorusGeometry(0.92, 0.06, 8, isMobile ? 14 : 24), haloMat);
  haloRing.rotation.x = Math.PI / 2;
  haloRing.position.y = -0.1;
  chandelierGroup.add(haloRing);
  group.add(chandelierGroup);

  // 8. Stacked Chip Towers (InstancedMesh near foreground corners)
  const chipGeo = new T.CylinderGeometry(0.085, 0.085, 0.028, isMobile ? 8 : 14);
  const chipMat = makeEnvMat(T, 0xffffff, 0.32, 0.35);
  const chipTransforms = [];
  const chipColors = [];
  const chipPalette = [0xdc2626, 0x2563eb, 0x16a34a, 0xfbbf24, 0x18181b];
  const stackBases = [
    { x: -0.45, z: 1.45, h: isMobile ? 5 : 8 },
    { x: -0.24, z: 1.52, h: isMobile ? 4 : 6 },
    { x: 0.35, z: 1.48, h: isMobile ? 5 : 7 },
    { x: 0.56, z: 1.36, h: isMobile ? 3 : 5 },
  ];
  for (let s = 0; s < stackBases.length; s++) {
    const sb = stackBases[s];
    for (let k = 0; k < sb.h; k++) {
      chipTransforms.push({ x: sb.x, y: 0.015 + k * 0.03, z: sb.z });
      chipColors.push(chipPalette[(s + k) % chipPalette.length]);
    }
  }
  group.add(buildInstancedTransforms(T, chipGeo, chipMat, chipTransforms, chipColors));

  registerUpdater((elapsed) => {
    chandelierGroup.rotation.y = elapsed * 0.22;
    haloMat.emissiveIntensity = 0.95 + 0.25 * Math.sin(elapsed * 2.5);
    neonCrownMat.emissiveIntensity = 1.05 + 0.32 * Math.sin(elapsed * 3.1);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 6: CITY-WHEELS-RACE (Highway Neon Light-Posts, Track Ring, Gantry)
 * -------------------------------------------------------------------------- */
function buildCityWheelsRace(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Asphalt Oval Track Surface Overlay (polygonOffset)
  const trackGeo = new T.RingGeometry(1.55, 3.85, isMobile ? 20 : 36);
  trackGeo.rotateX(-Math.PI / 2);
  const track = new T.Mesh(trackGeo, makeFloorOverlayMat(T, 0x18181b, 0.65, 0.25));
  track.position.y = 0.005;
  group.add(track);

  // 2. Highway Neon Light-Posts (Instanced posts + glowing light arms)
  const postGeo = mergeGeometrySpecs(T, [
    { geo: new T.CylinderGeometry(0.045, 0.06, 2.45, 8), x: 0, y: 1.225, z: 0 },
    { geo: new T.BoxGeometry(0.08, 0.06, 0.72), x: 0, y: 2.42, z: 0.34 },
  ]);
  const postCount = isMobile ? 5 : 8;
  const postTransforms = [];
  const barTransforms = [];
  const barColors = [];
  for (let i = 0; i < postCount; i++) {
    const t = i / (postCount - 1);
    const ang = -Math.PI * 0.8 + t * (Math.PI * 1.6);
    const rad = 3.92;
    postTransforms.push({
      x: Math.sin(ang) * rad,
      y: 0,
      z: -Math.cos(ang) * rad,
      ry: -ang,
    });
    barTransforms.push({
      x: Math.sin(ang) * (rad - 0.38),
      y: 2.38,
      z: -Math.cos(ang) * (rad - 0.38),
      ry: -ang,
    });
    barColors.push(i % 2 === 0 ? accent : 0xf43f5e);
  }
  group.add(buildInstancedTransforms(T, postGeo, makeEnvMat(T, 0x334155, 0.35, 0.85), postTransforms));

  const barGeo = new T.BoxGeometry(0.14, 0.05, 0.56);
  const barMat = makeEnvMat(T, 0xffffff, 0.12, 0.2, { emissive: accent, emissiveIntensity: 1.1 });
  registerEraMat(barMat, 'accent');
  group.add(buildInstancedTransforms(T, barGeo, barMat, barTransforms, barColors));

  // 3. Starting Gantry Arch + Guardrail Curb
  const gantrySpecs = [
    { geo: new T.BoxGeometry(0.16, 2.15, 0.16), x: -2.45, y: 1.075, z: -2.55 },
    { geo: new T.BoxGeometry(0.16, 2.15, 0.16), x: 2.45, y: 1.075, z: -2.55 },
    { geo: new T.BoxGeometry(5.15, 0.32, 0.22), x: 0, y: 2.12, z: -2.55 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, gantrySpecs), makeEnvMat(T, 0x1e293b, 0.35, 0.8)));

  const startBeaconMat = makeEnvMat(T, 0x38bdf8, 0.1, 0.2, { emissive: 0x38bdf8, emissiveIntensity: 1.0 });
  registerEraMat(startBeaconMat, 'accent');
  const startStrip = new T.Mesh(new T.BoxGeometry(4.4, 0.1, 0.26), startBeaconMat);
  startStrip.position.set(0, 2.12, -2.55);
  group.add(startStrip);

  registerUpdater((elapsed) => {
    barMat.emissiveIntensity = 0.8 + 0.45 * Math.sin(elapsed * 3.8);
    startBeaconMat.emissiveIntensity = 0.75 + 0.5 * Math.cos(elapsed * 4.5);
  });
}

/* --------------------------------------------------------------------------
 * STAGE 7: CHARACTER-TURNTABLE (& paperdoll-armory): Syndicate Dossier Backdrop Arch
 * -------------------------------------------------------------------------- */
function buildCharacterTurntable(T, ctx) {
  const { group, isMobile, era, registerEraMat, registerUpdater } = ctx;
  const accent = ERA_ACCENT_PALETTE[era - 1];

  // 1. Tactical Dossier Calibration Ring (polygonOffset)
  const calibGeo = new T.RingGeometry(1.02, 1.46, isMobile ? 20 : 36);
  calibGeo.rotateX(-Math.PI / 2);
  const calibRing = new T.Mesh(calibGeo, makeFloorOverlayMat(T, 0x1e293b, 0.3, 0.8));
  calibRing.position.y = 0.004;
  group.add(calibRing);

  // 2. Syndicate Dossier Backdrop Arch behind operative (z = -1.25)
  const archSpecs = [
    { geo: new T.BoxGeometry(0.18, 2.15, 0.18), x: -1.18, y: 1.075, z: -1.22, ry: 0.22 },
    { geo: new T.BoxGeometry(0.18, 2.15, 0.18), x: 1.18, y: 1.075, z: -1.22, ry: -0.22 },
    { geo: new T.BoxGeometry(2.58, 0.22, 0.2), x: 0, y: 2.22, z: -1.25 },
    { geo: new T.BoxGeometry(2.75, 0.12, 0.32), x: 0, y: 0.06, z: -1.25 },
  ];
  const dossierArch = new T.Mesh(mergeGeometrySpecs(T, archSpecs), makeEnvMat(T, 0x1f2428, 0.28, 0.86));
  dossierArch.castShadow = true;
  group.add(dossierArch);

  // 3. Emissive Dossier Telemetry Light Strips + Rotating Halo Ring
  const dossierMat = makeEnvMat(T, accent, 0.14, 0.3, { emissive: accent, emissiveIntensity: 0.95 });
  registerEraMat(dossierMat, 'accent');
  const stripSpecs = [
    { geo: new T.BoxGeometry(0.05, 1.82, 0.06), x: -1.06, y: 1.08, z: -1.14, ry: 0.22 },
    { geo: new T.BoxGeometry(0.05, 1.82, 0.06), x: 1.06, y: 1.08, z: -1.14, ry: -0.22 },
    { geo: new T.BoxGeometry(1.96, 0.05, 0.06), x: 0, y: 2.12, z: -1.16 },
  ];
  group.add(new T.Mesh(mergeGeometrySpecs(T, stripSpecs), dossierMat));

  const scannerHalo = new T.Mesh(
    new T.TorusGeometry(0.72, 0.02, 6, isMobile ? 16 : 28),
    dossierMat
  );
  scannerHalo.position.set(0, 1.18, -1.22);
  group.add(scannerHalo);

  registerUpdater((elapsed) => {
    scannerHalo.rotation.z = elapsed * 0.45;
    dossierMat.emissiveIntensity = 0.72 + 0.28 * Math.sin(elapsed * 2.4);
  });
}

/* --------------------------------------------------------------------------
 * PUBLIC ENTRYPOINT: dressStageEnvironment3D(THREE_REF, stageKind, scene, opts)
 * -------------------------------------------------------------------------- */
export function dressStageEnvironment3D(THREE_REF, stageKind, scene, opts = {}) {
  const T = THREE_REF && typeof THREE_REF.Group === 'function' ? THREE_REF : DEFAULT_THREE;
  const normKind = typeof stageKind === 'string' && stageKind.trim() ? stageKind.trim() : 'safehouse-empire';
  const isMobile = resolveIsMobile(opts);
  const reducedMotion = resolveReducedMotion(opts);

  const group = new T.Group();
  group.name = `z3d-env-${normKind}`;

  let currentEra = Math.max(1, Math.min(6, Number(opts.era) || 1));
  let elapsed = 0;
  let disposed = false;

  const eraMaterials = [];
  const updaters = [];

  const registerEraMat = (mat, role = 'accent', intensityScale = 1.0) => {
    eraMaterials.push({ mat, role, intensityScale });
    return mat;
  };
  const registerUpdater = (fn) => {
    if (typeof fn === 'function') updaters.push(fn);
  };

  const ctx = {
    group,
    isMobile,
    reducedMotion,
    era: currentEra,
    registerEraMat,
    registerUpdater,
  };

  if (normKind === 'safehouse-empire') {
    buildSafehouseEmpire(T, ctx);
  } else if (normKind === 'heist-breach') {
    buildHeistBreach(T, ctx);
  } else if (normKind === 'combat-arena') {
    buildCombatArena(T, ctx);
  } else if (normKind === 'gym-ironpit') {
    buildGymIronpit(T, ctx);
  } else if (normKind === 'casino-royale') {
    buildCasinoRoyale(T, ctx);
  } else if (normKind === 'city-wheels-race') {
    buildCityWheelsRace(T, ctx);
  } else {
    // 'character-turntable', 'paperdoll-armory', or unknown fallback
    buildCharacterTurntable(T, ctx);
  }

  const drawCalls = finalizeAndCountDrawCalls(group);
  group.userData = Object.assign(group.userData || {}, {
    z3dEnvironment: true,
    stageKind: normKind,
    isMobile,
    drawCalls,
    era: currentEra,
  });

  if (scene && typeof scene.add === 'function') {
    scene.add(group);
  }

  function setEra(eraNum) {
    if (disposed) return currentEra;
    const next = Math.max(1, Math.min(6, Number(eraNum) || 1));
    currentEra = next;
    const accentHex = ERA_ACCENT_PALETTE[next - 1];
    const trimHex = ERA_TRIM_PALETTE[next - 1];
    for (let i = 0; i < eraMaterials.length; i++) {
      const entry = eraMaterials[i];
      const hex = entry.role === 'trim' ? trimHex : accentHex;
      if (entry.mat && entry.mat.color) entry.mat.color.setHex(hex);
      if (entry.mat && entry.mat.emissive) entry.mat.emissive.setHex(hex);
    }
    group.userData.era = next;
    return next;
  }

  function update(dt = 0.016) {
    if (disposed) return;
    if (reducedMotion || resolveReducedMotion(opts)) return;
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    elapsed += safeDt;
    for (let i = 0; i < updaters.length; i++) {
      updaters[i](elapsed, safeDt);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (group.parent && typeof group.parent.remove === 'function') {
      group.parent.remove(group);
    } else if (scene && typeof scene.remove === 'function') {
      scene.remove(group);
    }

    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    group.traverse((obj) => {
      if (obj.isInstancedMesh && typeof obj.dispose === 'function') {
        obj.dispose();
      }
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (let i = 0; i < list.length; i++) {
          const mat = list[i];
          if (!mat) continue;
          materials.add(mat);
          const vals = Object.values(mat);
          for (let v = 0; v < vals.length; v++) {
            if (vals[v] && vals[v].isTexture) textures.add(vals[v]);
          }
        }
      }
    });

    for (const tex of textures) {
      if (typeof tex.dispose === 'function') tex.dispose();
    }
    for (const mat of materials) {
      if (typeof mat.dispose === 'function') mat.dispose();
    }
    for (const geo of geometries) {
      if (typeof geo.dispose === 'function') geo.dispose();
    }

    if (typeof group.clear === 'function') group.clear();
    eraMaterials.length = 0;
    updaters.length = 0;
  }

  return {
    group,
    update,
    setEra,
    dispose,
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.__Zone3DEnvironments = { dressStageEnvironment3D };
}
