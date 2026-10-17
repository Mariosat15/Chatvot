// CHARTVOLT PATCH (see CHARTVOLT-PATCHES.md, "Step-numbered input frames").
// One frame = the controls for ONE 1/60 s physics step, numbered, so the server can apply
// exactly the steps the client already predicted, and the client can replay the ones the
// server has not applied yet. Byte-identical copy lives in the vendor client source.
export const MAX_FRAMES_PER_MESSAGE=30;
export const FIRE_BIT=8;
// Reason: steer is quantised to 1/1000 BEFORE the client predicts with it, so the client's
// prediction and the server's authoritative step use bit-identical inputs.
export function encodeFrame(step,v){return [step,Math.round(Math.max(-1,Math.min(1,v.steer))*1000),(v.throttle?1:0)|(v.brake?2:0)|(v.boost?4:0)|(v.fire?FIRE_BIT:0)];}
export function decodeFrame(f){
 if(!Array.isArray(f)||f.length!==3)return null;
 const [step,steer,bits]=f;
 if(!Number.isSafeInteger(step)||step<0||!Number.isInteger(steer)||Math.abs(steer)>1000||!Number.isInteger(bits)||bits<0||bits>15)return null;
 return{step,input:{steer:steer/1000,throttle:Boolean(bits&1),brake:Boolean(bits&2),boost:Boolean(bits&4),fire:Boolean(bits&FIRE_BIT)}};
}
export function quantizeInput(step,v){return decodeFrame(encodeFrame(step,v));}
