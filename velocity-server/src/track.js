import * as THREE from 'three';
import {CircuitCurve} from './circuit-curve.js';
import {TRACKS} from './tracks.js';
export const HALF_WIDTH=16;
export function createTrack(id='orbital'){
  const definition=TRACKS.find(t=>t.id===id)||TRACKS[0];
  const points=definition.points.map(p=>new THREE.Vector3(...p));
  const curve=new CircuitCurve(points);curve.arcLengthDivisions=4000;curve.updateArcLengths();const length=curve.getLength(),startOffset=(definition.startFraction||0)*length;
  const worldUp=new THREE.Vector3(0,1,0),ahead=new THREE.Vector3(),behind=new THREE.Vector3();
  function frame(distance,out={p:new THREE.Vector3(),forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3(),bank:0}){
    const t=(((distance+startOffset)%length)+length)%length/length;curve.getPointAt(t,out.p);curve.getTangentAt(t,out.forward).normalize();out.right.crossVectors(out.forward,worldUp).normalize();out.up.crossVectors(out.right,out.forward).normalize();
    const k=(curvature(distance-16)+2*curvature(distance-8)+3*curvature(distance)+2*curvature(distance+8)+curvature(distance+16))/9;out.bank=Math.atan(k*80)*.22;out.right.applyAxisAngle(out.forward,out.bank);out.up.crossVectors(out.right,out.forward).normalize();return out;
  }
  function curvature(distance){const t=(((distance+startOffset)%length)+length)%length/length,e=2/length;curve.getTangentAt((t+e)%1,ahead);curve.getTangentAt((t-e+1)%1,behind);return (behind.x*ahead.z-behind.z*ahead.x)/4;}
  return {curve,length,frame,curvature,definition};
}
