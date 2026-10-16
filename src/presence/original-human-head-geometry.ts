import * as THREE from 'three';

/**
 * Original Mira R&D head topology. Every nose bridge, cheek and jaw bump is
 * deformed into the same closed mesh; no third-party scan, photo or likeness.
 *
 * Dimensions are in head-local metres. This is still a stylised lab mannequin,
 * NOT a photoreal / release-approved human.
 */
export function originalHeadPosition(x:number,y:number,z:number):[number,number,number]{
 const gaussian=(dx:number,dy:number,sx:number,sy:number)=>
  Math.exp(-.5*((dx/sx)**2+(dy/sy)**2));
 const front=Math.max(0,Math.min(1,(z-.025)/.12));
 const taper=y<-.095?1-.075*Math.min(1,(-y-.095)/.18):1;
 const xx=x*.224*taper;
 const yy=y*.290;
 let zz=z*.204;
 // Continuous nasal ridge + tip; never a standalone orb.
 const bridge=gaussian(xx,yy+.016,.031,.083)*.010;
 const tip=gaussian(xx,yy+.047,.029,.034)*.028;
 // A restrained natural cheek fullness on the same continuous surface.
 const cheeks=(gaussian(xx-.115,yy+.063,.045,.054)
       +gaussian(xx+.115,yy+.063,.045,.054))*.0045;
 const leftSocket=gaussian(xx+.102,yy-.056,.046,.036);
 const rightSocket=gaussian(xx-.102,yy-.056,.046,.036);
 const socket=(leftSocket+rightSocket)*.011;
 zz+=front*(bridge+tip+cheeks-socket);
 return [xx,yy,zz];
}

export function createOriginalHeadGeometry():THREE.SphereGeometry{
 const geometry=new THREE.SphereGeometry(1,72,56);
 const a=geometry.getAttribute('position') as THREE.BufferAttribute;
 for(let i=0;i<a.count;i++){
  const [x,y,z]=originalHeadPosition(a.getX(i),a.getY(i),a.getZ(i));
  a.setXYZ(i,x,y,z);
 }
 a.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
}
