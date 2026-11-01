// Authored Quaternius hand poses, with a cylindrical grasp fitted to the shared rig.
// The weapon's handle point, rather than its model origin, belongs at this socket.
const normalized = name => name.toLowerCase().replace(/[._-]/g, '');
// Cylindrical grasp solved on the shared Quaternius hand skeleton. Preserve
// segment lengths and bone twist while wrapping the phalanges around the handle.
const GRIP_POSE = {
  index2r: [-.28201536,.04924117,-.08754596,.95413751],
  index3r: [-.47808654,-.00801156,-.00399864,.87826711],
  index4r: [.40677024,.08291927,-.03741699,-.90898976],
  middle2r: [-.48617867,-.01820694,.00218277,.87366703],
  middle3r: [.48015665,.01209548,.00088714,-.87709895],
  middle4r: [-.49162986,.00040609,.00564177,.87078599],
  ring2r: [-.40995336,-.13766070,.11409839,.89441005],
  ring3r: [.43894603,.10208347,-.08988050,-.88815921],
  ring4r: [-.40100854,-.07756922,.17082326,.89665743],
  pinky2r: [-.23944840,-.17956387,.21665471,.92923735],
  pinky3r: [-.37648017,.06390473,.01832485,.92403632],
  pinky4r: [.39358854,-.02463288,.01859723,-.91876857]
};

export function gripPoseBoneKeys() {
  return Object.keys(GRIP_POSE);
}

export function isGripPoseBoneKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(GRIP_POSE, key);
}

export function requiredGripPoseBoneCount() {
  return 19;
}

export function defaultGripCenterArray() {
  return [.014, .143, -.034];
}

export function defaultGripAxisArray() {
  return [-.98519729, .17142433, 0];
}

export function isGripRigValid(rig) {
  return Boolean(rig?.hand && Array.isArray(rig?.pose) && rig.pose.length === 19 && rig?.center && rig?.axis);
}

export function gripPoseExplicitBoneCount() {
  return Object.keys(GRIP_POSE).length;
}

export function gripRightWristBoneKey() {
  return 'wristr';
}

export function equippedWeaponGroupName() {
  return 'ZONE equipped weapon';
}

export function hiddenWardrobePropNames() {
  return ['pistol', 'gun', 'sword'];
}

export function thumbSlerpFactor() {
  return 1;
}

export function nonThumbDefaultSlerpFactor() {
  return 0.5;
}

export function gripClosedPoseClipName() {
  return 'Idle_Sword';
}

export function gripOpenPoseClipName() {
  return 'Idle';
}

export function gripPoseQuaternionMap() {
  return { ...GRIP_POSE };
}

export function defaultForwardBarrelAxis() {
  return [0, 1, 0];
}

export function defaultMeshZeroRotation() {
  return [0, 0, 0];
}

function poseTracks(THREE, clip) {
  const values = new Map();
  for (const track of clip?.tracks || []) {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    if (binding.propertyName !== 'quaternion') continue;
    const key = normalized(binding.nodeName || '');
    if (!/^(index|middle|ring|pinky|thumb)[1-4]r$/.test(key)) continue;
    values.set(key, new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(0)));
  }
  return values;
}

export function applyCharacterGrip(rig) {
  for (const { bone, quaternion } of rig?.pose || []) bone.quaternion.copy(quaternion);
}

export function prepareCharacterGrip(THREE, root, clips) {
  const bones = new Map(), hiddenProps = [];
  root.traverse(object => {
    if (object.isBone) bones.set(normalized(object.name), object);
    // These two wardrobe files contain a skinned demo pistol, independent of equipment.
    if (/^(pistol|gun|sword)$/i.test(object.name)) {
      object.visible = false;
      hiddenProps.push(object.name);
    }
  });
  const hand = bones.get('wristr');
  if (!hand) throw new Error('Character is missing its right wrist');
  const closed = poseTracks(THREE, clips.Idle_Sword), open = poseTracks(THREE, clips.Idle);
  const pose = [];
  for (const [key, target] of closed) {
    const bone = bones.get(key);
    if (bone) pose.push({ bone, quaternion: GRIP_POSE[key]
      ? new THREE.Quaternion(...GRIP_POSE[key]).normalize()
      : (open.get(key) || bone.quaternion).clone().slerp(target, key.startsWith('thumb') ? 1 : .5) });
  }
  if (pose.length !== 19) throw new Error('Character is missing its authored right-hand grip pose');
  const rig = { hand, pose, hiddenProps };
  applyCharacterGrip(rig);
  root.updateMatrixWorld(true);
  // Full thumb closure narrows the cavity. This measured 3.16 mm socket shift
  // retains at least 12.66 mm shaft clearance across all three real skins.
  rig.center = new THREE.Vector3(.014, .143, -.034);
  rig.axis = new THREE.Vector3(-.98519729, .17142433, 0).normalize();
  return rig;
}

export function attachHeldWeapon(THREE, rig, mesh, gripPoint, axisSign = 1, forward = false) {
  const hold = new THREE.Group();
  hold.name = 'ZONE equipped weapon';
  hold.position.copy(rig.center);
  const localGripAxis = Array.isArray(axisSign) ? new THREE.Vector3(...axisSign).normalize()
    : new THREE.Vector3(0, axisSign, 0);
  hold.quaternion.setFromUnitVectors(localGripAxis, rig.axis);
  if (forward) {
    // Catalog barrels point along +X and their handles along -Y. Align both
    // axes so a valid palm position cannot rotate the barrel into the forearm.
    const up = rig.axis.clone().negate();
    const barrel = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y).normalize();
    hold.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      barrel, up, barrel.clone().cross(up).normalize()));
  }
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(-gripPoint[0], -gripPoint[1], -gripPoint[2]).multiply(mesh.scale);
  hold.add(mesh);
  hold.userData.zoneOwnedGeometry = !!mesh.userData.zoneOwnedGeometry;
  hold.userData.zoneGripMesh = mesh;
  hold.userData.zoneGripPoint = gripPoint.slice();
  rig.hand.add(hold);
  return hold;
}

export function inspectCharacterGrip(rig) {
  return {
    hasHand: Boolean(rig?.hand),
    poseBoneCount: Array.isArray(rig?.pose) ? rig.pose.length : 0,
    hiddenPropCount: Array.isArray(rig?.hiddenProps) ? rig.hiddenProps.length : 0,
    hasCenter: Boolean(rig?.center),
    hasAxis: Boolean(rig?.axis),
  };
}
