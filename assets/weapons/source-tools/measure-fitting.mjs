import * as THREE from '../../../lib/three184/three.module.js';
import { geometryGlb, orientObject, actualBounds, sideSurfaces } from './geometry-audit.mjs';
const cases = [
 ['premium/v99/loafbrr-revolver.glb',0,[[0,.06],[.02,.07],[.03,.08]]],
 ['premium/v99/tabasco-l85.glb',-Math.PI/2,[[-.5,-.8],[0,-.8],[.5,-.8],[1,-.8],[1.5,-.8],[2,-.8]]],
 ['premium/v99/tabasco-g3a3.glb',-Math.PI/2,[[-2,-.6],[-1.5,-.6],[-1,-.6],[-.5,-.6],[0,-.6]]],
 ['premium/v99/tabasco-mosin9130.glb',-Math.PI/2,[[-2.5,0],[-3,0],[-3.5,0],[-4,0]]],
 ['premium/v99/tabasco-dragunov.glb',-Math.PI/2,[[-3.5,-.55],[-3,-.55],[-2.5,-.55],[-2,-.55],[-1.5,-.55]]],
 ['premium/v99/tabasco-m1911.glb',Math.PI/2,[[-2.5,-1.5],[-3,-1.5],[-3.5,-1.5]]],
 ['premium/v99/jean-doublebarrel-safe.glb',-Math.PI/2,[[0,0],[-.5,0],[.5,0]]],
 ['library/models/cc0-guns-explosives-pack-glb--luger.glb',Math.PI/2,[[-.03,-.04],[-.04,-.04],[-.02,-.04]],['Clip']],
 ['library/models/cc0-guns-explosives-pack-glb--ak47.glb',-Math.PI/2,[[-.28,-.10],[-.29,-.10],[-.30,-.10]]],
 ['library/models/cc0-guns-explosives-pack-glb--suomi-kp.glb',-Math.PI/2,[[-.12,-.06],[-.14,-.06],[-.16,-.06]]],
];
for(const [path,angle,samples,exclude=[]] of cases){
 const object=orientObject((await geometryGlb('assets/weapons/'+path)).scene,[0,angle,0]);
 for(const name of exclude) object.getObjectByName(name)?.removeFromParent();
 const box = new THREE.Box3().setFromObject(object);
 console.log(path,JSON.stringify({min:box.min.toArray(),max:box.max.toArray(),parts:actualBounds(object).map(r=>({name:r.name,min:r.min,max:r.max}))}));
 console.log('SURFACES',JSON.stringify(samples.map(([x,y])=>({x,y,sides:sideSurfaces(object,x,y)}))));
}
