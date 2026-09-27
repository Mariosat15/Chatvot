import {Curve,Vector3} from 'three';
// Closed uniform cubic B-spline: position, tangent and curvature are continuous
// across every control span and at the lap seam. Unlike interpolation through
// every waypoint, a design point cannot create a sharp Catmull-Rom knuckle.
export class CircuitCurve extends Curve{
 constructor(points){super();this.points=points;this.arcLengthDivisions=6000;}
 getPoint(t,target=new Vector3()){const n=this.points.length,u=((t%1)+1)%1*n,i=Math.floor(u),f=u-i,f2=f*f,f3=f2*f,w=[(1-3*f+3*f2-f3)/6,(4-6*f2+3*f3)/6,(1+3*f+3*f2-3*f3)/6,f3/6];target.set(0,0,0);for(let j=0;j<4;j++)target.addScaledVector(this.points[(i+j-1+n)%n],w[j]);return target;}
 getTangent(t,target=new Vector3()){const n=this.points.length,u=((t%1)+1)%1*n,i=Math.floor(u),f=u-i,f2=f*f,w=[(-3+6*f-3*f2)/6,(-12*f+9*f2)/6,(3+6*f-9*f2)/6,3*f2/6];target.set(0,0,0);for(let j=0;j<4;j++)target.addScaledVector(this.points[(i+j-1+n)%n],w[j]);return target.normalize();}
}
