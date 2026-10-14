// Worn armor uses only a derived torso surface from the retained CC0 Swat asset.
// It is a representative vest, not an item-exact model for arbitrary content.
export function armorReceipt(packet = {}) {
  const id = typeof packet.armorId === 'string' && packet.armorId && packet.armorOwned === true ? packet.armorId : null;
  const reduction = Number(packet.armorReduction);
  return { armorId:id, label:id ? String(packet.armorLabel || id) : '', reduction:id && Number.isFinite(reduction) ? Math.max(0,Math.min(.95,reduction)) : 0,
    representation:id && ['armor','vest'].includes(id) ? 'authored-tactical-vest' : id ? 'no-worn-model' : 'none', itemExact:false };
}

export function createWornVest(THREE, targetRoot, sourceRoot) {
  const target = []; targetRoot.traverse(node => { if (node.isSkinnedMesh && !/Pistol/i.test(node.parent?.name || '')) target.push(node); });
  if (!target.length) throw new Error('Armor target has no retained rig');
  const skeleton = target[0].skeleton, boneMap = new Map(skeleton.bones.map((bone,index) => [bone.name,index]));
  const body = sourceRoot.getObjectByName('Swat_Body');
  if (!body) throw new Error('Authored tactical torso is unavailable');
  const meshes = [];
  body.traverse(source => {
    if (!source.isSkinnedMesh || !['Swat', 'Swat_Black'].includes(source.material?.name)) return;
    const original = source.geometry, positions = original.attributes.position, joints = original.attributes.skinIndex, weights = original.attributes.skinWeight;
    const torso = new Set(source.skeleton.bones.map((bone,index) => /^(Chest|Torso|Abdomen|Hips)$/i.test(bone.name) ? index : -1).filter(index => index >= 0));
    const belongs = index => { let influence = 0; for (let part=0;part<4;part++) if (torso.has(joints.getComponent(index,part))) influence += weights.getComponent(index,part); return influence >= .75; };
    const triangles = [], index = original.index;
    for (let n=0;n<(index?.count || positions.count);n+=3) { const face=[0,1,2].map(offset => index ? index.getX(n+offset) : n+offset); if (face.every(belongs)) triangles.push(...face); }
    if (triangles.length < 30) throw new Error('Authored vest torso selection is empty');
    const vertices = [...new Set(triangles)], remap = new Map(vertices.map((value,n) => [value,n])), geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(original.attributes)) {
      const array = new attribute.array.constructor(vertices.length*attribute.itemSize);
      for (let n=0;n<vertices.length;n++) for (let part=0;part<attribute.itemSize;part++) {
        let value=attribute.getComponent(vertices[n],part);
        if (name==='skinIndex') { const mapped=boneMap.get(source.skeleton.bones[value]?.name); if (mapped==null) throw new Error('Armor rig bone mismatch'); value=mapped; }
        array[n*attribute.itemSize+part]=value;
      }
      geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
    }
    geometry.setIndex(triangles.map(value=>remap.get(value)));
    geometry.computeBoundingBox(); const center=geometry.boundingBox.getCenter(new THREE.Vector3()), position=geometry.attributes.position;
    // Whole-vest fitting below uses the actual retained clothing envelope.
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material=source.material.clone(); material.roughness=.86; material.metalness=0; material.clearcoat=0;
    const mesh=new THREE.SkinnedMesh(geometry,material); mesh.name='ZONE representative worn vest'; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false;
    mesh.bind(skeleton,target[0].bindMatrix); mesh.userData.zoneArmorSource='Swat.glb#Swat_Body:'+source.material.name+' torso'; targetRoot.add(mesh); meshes.push(mesh);
  });
  if (!meshes.length) throw new Error('Authored vest surface is unavailable');
  const sourceBox=new THREE.Box3(),targetBox=new THREE.Box3(),point=new THREE.Vector3();
  for(const mesh of meshes)sourceBox.union(mesh.geometry.boundingBox);
  for(const mesh of target){
    const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
    for(let n=0;n<p.count;n++){
      let influence=0;for(let c=0;c<4;c++)if(/^(Chest|Torso|Abdomen|Hips)$/i.test(mesh.skeleton.bones[j.getComponent(n,c)]?.name || ''))influence+=w.getComponent(n,c);
      point.fromBufferAttribute(p,n);if(influence>=.4 && point.y>=sourceBox.min.y && point.y<=sourceBox.max.y)targetBox.expandByPoint(point);
    }
  }
  if(targetBox.isEmpty())throw new Error('Retained torso fit is unavailable');
  const sourceSize=sourceBox.getSize(new THREE.Vector3()),targetSize=targetBox.getSize(new THREE.Vector3()),sourceCenter=sourceBox.getCenter(new THREE.Vector3()),targetCenter=targetBox.getCenter(new THREE.Vector3());
  const sx=Math.max(1.14,targetSize.x*1.035/sourceSize.x),sz=Math.max(1.35,targetSize.z*1.08/sourceSize.z);
  for(const mesh of meshes){const p=mesh.geometry.attributes.position;for(let n=0;n<p.count;n++){p.setX(n,targetCenter.x+(p.getX(n)-sourceCenter.x)*sx);p.setZ(n,targetCenter.z+(p.getZ(n)-sourceCenter.z)*sz);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.userData.zoneArmorFit={widthScale:sx,depthScale:sz,source:'retained-clothing-envelope'};}
  let disposed=false;
  return { meshes, dispose(){ if(disposed)return;disposed=true; for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();} } };
}

export function createArmorController({THREE,loadSource,publish=()=>{},queueFrame=()=>{}}) {
  let generation=0,active=null,last='',lastStatus='none',disposed=false;
  function clear(){active?.dispose();active=null;last='';}
  async function update(packet,actor){
    const receipt=armorReceipt(packet), key=JSON.stringify([actor?.uuid,receipt.armorId]);
    if (disposed) return;
    if (last===key) { publish({...receipt,status:lastStatus}); return; }
    const seq=++generation;clear();last=key;
    if (!receipt.armorId || receipt.representation==='no-worn-model' || !actor) { lastStatus=receipt.armorId ? 'unrepresented' : 'none';publish({...receipt,status:lastStatus});queueFrame();return; }
    if (actor.userData.outfit==='Swat') { lastStatus='ready';publish({...receipt,status:lastStatus,representation:'existing-tactical-costume'});queueFrame();return; }
    lastStatus='loading';publish({...receipt,status:lastStatus});
    try { const source=await loadSource();if(disposed || seq!==generation)return;active=createWornVest(THREE,actor,source.scene || source);lastStatus='ready';publish({...receipt,status:lastStatus});queueFrame(); }
    catch(error){if(disposed || seq!==generation)return;lastStatus='unrepresented';publish({...receipt,status:lastStatus,reason:'worn-asset-unavailable'});queueFrame();}
  }
  return {update,dispose(){disposed=true;++generation;clear();}};
}
