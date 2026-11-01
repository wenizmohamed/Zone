// Weapon handling is an upper-body layer over the authored locomotion clips.
// Targets are palm sockets, converted to wrist targets before two-bone IK.
export function weaponPoseProfile(key, catalog = {}) {
  if (!key || key === 'fists') return 'unarmed';
  if (key === 'bat') return 'bat';
  if (key === 'knife') return 'knife';
  const family = catalog[key]?.fam || key;
  return /pistol|revolver/i.test(family) ? 'handgun' : 'longgun';
}

export function supportedWeaponPoseProfiles() {
  return ['unarmed', 'bat', 'knife', 'handgun', 'longgun'];
}

export function isSupportedWeaponPoseProfile(profile) {
  return ['unarmed', 'bat', 'knife', 'handgun', 'longgun'].includes(String(profile ?? ''));
}

export function isMeleePoseProfile(profile) {
  return profile === 'bat' || profile === 'knife';
}

export function isFirearmPoseProfile(profile) {
  return profile === 'handgun' || profile === 'longgun';
}

export function supportedWeaponPoseProfileCount() {
  return supportedWeaponPoseProfiles().length;
}

export function isUnarmedPoseProfile(profile) {
  return profile === 'unarmed';
}

export function mosinIdleRollDegrees() {
  return 15;
}

export function knifeBladeRollDegrees() {
  return 70;
}

export function mosinIdleCarryMode() {
  return 'mosin-idle-carry';
}

export function mosinIdleCarrySourceId() {
  return 'mosin9130-detail112';
}

export function mosinIdleCalibrationVersion() {
  return 114;
}

export function armReachMinClearanceM() {
  return .005;
}

export function armReachMaxMarginM() {
  return .008;
}

export function defaultMosinAnchorAdjustmentM() {
  return [0, 0, 0];
}

export function requiredArmSides() {
  return ['r', 'l'];
}

export function prepareWeaponPose(THREE, root, gripRig) {
  const bones = new Map();
  root.traverse(o => { if (o.isBone) bones.set(o.name.toLowerCase().replace(/[._-]/g, ''), o); });
  const arm = side => ({ upper: bones.get('upperarm' + side), lower: bones.get('lowerarm' + side), hand: bones.get('wrist' + side) });
  const rig = { THREE, root, grip: gripRig, right: arm('r'), left: arm('l'), chest: bones.get('chest'), bones };
  if (![rig.right, rig.left].every(a => a.upper && a.lower && a.hand)) throw new Error('Weapon pose requires both authored arm chains');
  root.updateMatrixWorld(true);
  rig.chestReference = rig.chest.getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const a of [rig.right, rig.left]) {
    const p = o => o.getWorldPosition(new THREE.Vector3());
    a.upperLength = p(a.upper).distanceTo(p(a.lower));
    a.lowerLength = p(a.lower).distanceTo(p(a.hand));
    const side = a === rig.right ? 'r' : 'l';
    a.palmDirection = a.hand.worldToLocal(p(bones.get('middle2' + side))).normalize();
  }
  // Mirroring quaternion X preserves the existing finger bend and bone lengths.
  rig.leftFingers = gripRig.pose.map(({ bone, quaternion }) => ({ bone: bones.get(bone.name.toLowerCase().replace(/[._-]/g, '').replace(/r$/, 'l')),
    quaternion: new THREE.Quaternion(quaternion.x, -quaternion.y, -quaternion.z, quaternion.w) })).filter(p => p.bone);
  return rig;
}

export function inspectWeaponPoseRig(rig) {
  if (!rig) return null;
  return {
    hasChest: !!rig.chest,
    rightArmLengthsM: [Number((rig.right?.upperLength || 0).toFixed(5)), Number((rig.right?.lowerLength || 0).toFixed(5))],
    leftArmLengthsM: [Number((rig.left?.upperLength || 0).toFixed(5)), Number((rig.left?.lowerLength || 0).toFixed(5))],
    leftFingerCount: Array.isArray(rig.leftFingers) ? rig.leftFingers.length : 0,
  };
}

function worldQuaternion(rig, bone, desired) {
  const parent = bone.parent.getWorldQuaternion(new rig.THREE.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(desired));
  bone.updateWorldMatrix(false, true);
}

function aimBone(rig, bone, child, target) {
  const T = rig.THREE, origin = bone.getWorldPosition(new T.Vector3());
  const current = child.getWorldPosition(new T.Vector3()).sub(origin).normalize();
  const direction = target.clone().sub(origin).normalize();
  const delta = new T.Quaternion().setFromUnitVectors(current, direction);
  worldQuaternion(rig, bone, delta.multiply(bone.getWorldQuaternion(new T.Quaternion())));
}

function solveArm(rig, arm, target, pole, desiredHand) {
  const T = rig.THREE, origin = arm.upper.getWorldPosition(new T.Vector3());
  const direction = target.clone().sub(origin), rawDistance = direction.length();
  const distance = T.MathUtils.clamp(rawDistance, Math.abs(arm.upperLength - arm.lowerLength) + .005, arm.upperLength + arm.lowerLength - .008);
  direction.normalize();
  const end = origin.clone().addScaledVector(direction, distance);
  // Choose the elbow on its anatomical reach circle that aligns the forearm
  // with the metacarpals. A fixed pole folds the wrist during crossed swings.
  const palm = arm.palmDirection.clone().applyQuaternion(desiredHand);
  const preferredElbow = end.clone().addScaledVector(palm, -arm.lowerLength);
  const bend = preferredElbow.sub(origin).addScaledVector(direction, -preferredElbow.dot(direction));
  if (bend.lengthSq() < 1e-6) bend.copy(pole).sub(origin).addScaledVector(direction, -pole.clone().sub(origin).dot(direction));
  bend.normalize();
  const along = (arm.upperLength ** 2 - arm.lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, arm.upperLength ** 2 - along ** 2));
  const elbow = origin.clone().addScaledVector(direction, along).addScaledVector(bend, height);
  aimBone(rig, arm.upper, arm.lower, elbow);
  aimBone(rig, arm.lower, arm.hand, end);
  worldQuaternion(rig, arm.hand, desiredHand);
  return { error: arm.hand.getWorldPosition(new T.Vector3()).distanceTo(target), reach: rawDistance };
}

function knifeBladeRoll(T) {
  const halfAngle = T.MathUtils.degToRad(70) / 2;
  return new T.Quaternion(Math.sin(halfAngle), 0, 0, Math.cos(halfAngle));
}

function weaponOrientation(T, profile, forward) {
  const axis = forward.clone().normalize();
  if (profile === 'bat') {
    const z = new T.Vector3(-1, 0, 0).addScaledVector(axis, axis.x).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(axis.clone().cross(z), axis, z));
  }
  if (profile === 'knife') {
    const up = new T.Vector3(0, 0, -1).addScaledVector(axis, axis.z).normalize();
    // The M9's broad blade face is local XY. Roll around its +X length
    // axis so the normal portrait sees the face instead of a thin edge.
    // Keep the measured handle socket and physical asset scale unchanged.
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(axis, up, axis.clone().cross(up)))
      .multiply(knifeBladeRoll(T));
  }
  const up = new T.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(axis, up, axis.clone().cross(up)));
}

function configureMosinIdleGrip(rig, heldWeapon, profile, action, enabled) {
  const source = heldWeapon.userData.zoneGripMesh?.userData?.zoneWeaponAsset;
  const active = enabled && profile === 'longgun' && action === 'idle' && source?.id === 'mosin9130-detail112';
  let calibration = heldWeapon.userData.zoneMosinIdleStockGrip;
  if (active) {
    if (!calibration) {
      calibration = { version: 114, mode: 'mosin-idle-carry', sourceId: source.id,
        originalQuaternion: heldWeapon.quaternion.toArray(), rollDegrees: 15,
        anchorAdjustmentM: [0, 0, 0], firingGripResolved: false,
        canonicalArm: Object.fromEntries(['upper', 'lower', 'hand'].map(key => [key, rig.right[key].quaternion.toArray()])) };
      heldWeapon.userData.zoneMosinIdleStockGrip = calibration;
    }
    for (const key of ['upper', 'lower', 'hand']) {
      const bone = rig.right[key], solved = calibration.solvedArm?.[key];
      const unchanged = solved && bone.quaternion.toArray().every((value, i) => Math.abs(value - solved[i]) < 1e-12);
      // AnimationMixer skips writes when a sampled property has not changed.
      // Do not feed the carry IK result back into the canonical pose branch.
      // Retain new animation writes; otherwise continue the original IK's
      // own prior-frame state, maintained below independently of the carry.
      if (unchanged) bone.quaternion.fromArray(calibration.canonicalArm[key]);
      else calibration.canonicalArm[key] = bone.quaternion.toArray();
    }
    // Traditional stock carry, not the vertical pistol-grip axis. Only the
    // Mosin idle hand/forearm orientation changes. Natural finger quaternions,
    // measured palm anchor, source mesh, materials and scale stay unchanged.
    const T = rig.THREE;
    heldWeapon.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), rig.grip.axis)
      .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), T.MathUtils.degToRad(15)));
  } else if (calibration) {
    // Guard, fire, locomotion and reactions retain their original attachment.
    // The idle carrying pose is explicitly NOT a trigger-ready grip fix.
    heldWeapon.quaternion.fromArray(calibration.originalQuaternion);
    for (const key of ['upper', 'lower', 'hand']) {
      const solved = calibration.solvedArm?.[key], bone = rig.right[key];
      if (solved && bone.quaternion.toArray().every((value, i) => Math.abs(value - solved[i]) < 1e-12)) {
        bone.quaternion.fromArray(calibration.canonicalArm[key]);
      }
    }
    delete heldWeapon.userData.zoneMosinIdleStockGrip;
  }
  return active ? calibration : null;
}

export function applyWeaponPose(rig, heldWeapon, { profile, action = 'idle', phase = 0, elapsed = 0, dt = 0, mosinIdleGrip = true } = {}) {
  if (!rig || !heldWeapon || profile === 'unarmed') return null;
  const T = rig.THREE;
  const stockGrip = configureMosinIdleGrip(rig, heldWeapon, profile, action, mosinIdleGrip);
  if (profile === 'knife' && !heldWeapon.userData.zoneKnifeBladeRolled) {
    // Turn the knife within the unchanged handle axis, not the wrist. Applying
    // the same local roll to its attachment and desired weapon orientation
    // preserves the existing anatomical hand rotation and measured socket.
    heldWeapon.quaternion.multiply(knifeBladeRoll(T));
    heldWeapon.userData.zoneKnifeBladeRolled = true;
  }
  rig.root.updateMatrixWorld(true);
  // Keep targets relative to the animated chest, including recoil and hit reactions.
  const chest = rig.chest.getWorldPosition(new T.Vector3());
  const bodyTurn = rig.chest.getWorldQuaternion(new T.Quaternion()).multiply(rig.chestReference);
  const point = xyz => new T.Vector3(...xyz).sub(new T.Vector3(0, 1.339, .066)).applyQuaternion(bodyTurn).add(chest);
  const aim = action === 'guard';
  const strike = ['punch', 'slash', 'combo', 'heavy'].includes(action);
  const swing = strike ? Math.sin(Math.PI * T.MathUtils.clamp(phase, 0, 1)) : 0;
  let socket, forward, weaponFrame = bodyTurn;
  if (profile === 'bat') {
    socket = point([-.27 + swing * .25, 1.27 + swing * .05, .38 - swing * .04]);
    forward = new T.Vector3(-.38 + swing * .53, .9 - swing * .30, .18 + swing * .47);
  } else if (profile === 'knife') {
    if (action === 'slash' || action === 'combo') {
      // Anticipate beside the shoulder, cut across the torso, then recover.
      // The old sine bob kept the palm at almost one height and hid the
      // authored slash. These targets stay inside the same arm reach and
      // move the measured handle socket, never the blade inside the fingers.
      const p = T.MathUtils.clamp(phase, 0, 1);
      const sockets = [[-.26, 1.22, .36], [-.43, 1.52, .15], [.02, 1.20, .24]];
      const axes = [[-.20, .92, .25], [-.65, .75, .12], [.85, -.32, .12]];
      const leg = p < .20 ? [0, 1, 0, .20] : p < .55 ? [1, 2, .20, .55] : [2, 0, .55, 1];
      const blend = T.MathUtils.smoothstep(p, leg[2], leg[3]);
      // Follow chest translation but keep the offensive arc in the actor's
      // facing plane. The authored torso turn otherwise rotates the cut
      // towards the portrait camera and makes it read as a small poke.
      weaponFrame = rig.root.getWorldQuaternion(new T.Quaternion());
      socket = new T.Vector3(...sockets[leg[0]]).lerp(new T.Vector3(...sockets[leg[1]]), blend)
        .sub(new T.Vector3(0, 1.339, .066)).applyQuaternion(weaponFrame).add(chest);
      forward = new T.Vector3(...axes[leg[0]]).lerp(new T.Vector3(...axes[leg[1]]), blend);
    } else {
      // Keep the resting broad face, guard and non-slash reactions unchanged.
      const restOffset = aim || strike ? 0 : .035;
      socket = point([-.26 - restOffset + swing * .18, aim ? 1.27 : 1.22 + swing * .03, .36 + swing * .01]);
      forward = new T.Vector3(-.20 - restOffset + swing * .40, .92 - swing * .27, .25 + swing * .35);
    }
  } else if (profile === 'handgun') {
    socket = point([-.23, aim || strike ? 1.27 : 1.12, aim || strike ? .40 : .27]);
    forward = new T.Vector3(.28, aim || strike ? .02 : -.3, .92);
  } else {
    socket = point([-.19, aim || strike ? 1.28 : 1.17, .25]);
    forward = new T.Vector3(aim ? .32 : .68, aim ? .015 : -.18, aim ? .95 : .74);
  }
  socket.y += Math.sin(elapsed * 1.8) * .002;
  const desiredWeapon = weaponFrame.clone().multiply(weaponOrientation(T, profile, forward));
  if (dt > 0 && rig.previousPose?.profile === profile) {
    const blend = 1 - Math.exp(-20 * Math.min(dt, .1));
    socket.lerpVectors(rig.previousPose.socket, socket, blend);
    desiredWeapon.slerpQuaternions(rig.previousPose.rotation, desiredWeapon, blend);
  }
  rig.previousPose = { profile, socket: socket.clone(), rotation: desiredWeapon.clone() };
  const desiredHand = desiredWeapon.clone().multiply(heldWeapon.quaternion.clone().invert());
  const wristTarget = socket.clone().sub(rig.grip.center.clone().applyQuaternion(desiredHand));
  const rightPole = point(profile === 'longgun' || profile === 'handgun' ? [-.48, 1.10, .02] : [-.35, 1.02, .02]);
  if (stockGrip) {
    // Preserve the original right-arm branch as well as the attachment. This
    // bounded extra IK solve is Mosin idle only, with no geometry collision
    // work per frame. It prevents cached mixer properties from carrying the
    // new arm's twist into a later original guard/fire/reaction frame.
    const input = Object.fromEntries(['upper', 'lower', 'hand'].map(key => [key, rig.right[key].quaternion.toArray()]));
    const canonicalHand = desiredWeapon.clone().multiply(new T.Quaternion().fromArray(stockGrip.originalQuaternion).invert());
    solveArm(rig, rig.right, socket.clone().sub(rig.grip.center.clone().applyQuaternion(canonicalHand)), rightPole, canonicalHand);
    stockGrip.canonicalArm = Object.fromEntries(['upper', 'lower', 'hand'].map(key => [key, rig.right[key].quaternion.toArray()]));
    for (const key of ['upper', 'lower', 'hand']) rig.right[key].quaternion.fromArray(input[key]);
    rig.root.updateMatrixWorld(true);
  }
  const right = solveArm(rig, rig.right, wristTarget, rightPole, desiredHand);
  rig.root.updateMatrixWorld(true);
  let left = null, supportTarget = null;
  if (profile === 'longgun') {
    const support = heldWeapon.userData.zoneSupportPoint || [.24, .06, 0];
    supportTarget = heldWeapon.localToWorld(new T.Vector3(...support));
    // Palm up, with the fore-end crossing the fingers; the thumb closes on its side.
    const mirrorCenter = new T.Vector3(-rig.grip.center.x, rig.grip.center.y, rig.grip.center.z);
    const localAxis = new T.Vector3(-rig.grip.axis.x, rig.grip.axis.y, rig.grip.axis.z).normalize();
    const localPalm = mirrorCenter.clone().addScaledVector(localAxis, -mirrorCenter.dot(localAxis)).normalize();
    const barrel = new T.Vector3(1, 0, 0).applyQuaternion(desiredWeapon);
    const across = new T.Vector3(-forward.z, 0, forward.x).normalize().applyQuaternion(bodyTurn);
    const sourceBasis = new T.Matrix4().makeBasis(localAxis, localPalm, localAxis.clone().cross(localPalm)).transpose();
    const leftHand = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(barrel, across, barrel.clone().cross(across)).multiply(sourceBasis));
    const target = supportTarget.clone().sub(mirrorCenter.applyQuaternion(leftHand));
    left = solveArm(rig, rig.left, target, point([.47, 1.05, .10]), leftHand);
    for (const pose of rig.leftFingers) pose.bone.quaternion.copy(pose.quaternion);
  }
  rig.root.updateMatrixWorld(true);
  if (stockGrip) stockGrip.solvedArm = Object.fromEntries(['upper', 'lower', 'hand'].map(key => [key, rig.right[key].quaternion.toArray()]));
  return { profile, action, rightError: right.error, leftError: left?.error ?? null,
    ...(stockGrip ? { gripCalibration: { mode: stockGrip.mode, version: stockGrip.version,
      sourceId: stockGrip.sourceId, rollDegrees: stockGrip.rollDegrees, firingGripResolved: false } } : {}),
    socket: heldWeapon.getWorldPosition(new T.Vector3()).toArray(), supportTarget: supportTarget?.toArray() ?? null,
    axis: forward.normalize().toArray() };
}
