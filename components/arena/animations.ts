// ─── Arena CSS Animations ─────────────────────────────────────────────────────
// Injected once into <head> on mount

export const ARENA_KEYFRAMES = `
@keyframes derbyPulse {
  0%,100% { opacity:1 }
  50% { opacity:.6 }
}
@keyframes derbyShine {
  0% { background-position:-200% center }
  100% { background-position:200% center }
}
@keyframes derbyRun {
  0% { transform: translateY(0) }
  25% { transform: translateY(-2px) }
  50% { transform: translateY(0) }
  75% { transform: translateY(2px) }
  100% { transform: translateY(0) }
}
@keyframes derbyRunFast {
  0% { transform: translateY(0) rotate(0deg) }
  25% { transform: translateY(-3px) rotate(-1deg) }
  50% { transform: translateY(0) rotate(0deg) }
  75% { transform: translateY(3px) rotate(1deg) }
  100% { transform: translateY(0) rotate(0deg) }
}
@keyframes boostGlow {
  0% { box-shadow:0 0 10px rgba(15,237,190,.3) }
  50% { box-shadow:0 0 30px rgba(15,237,190,.7),0 0 60px rgba(15,237,190,.3) }
  100% { box-shadow:0 0 10px rgba(15,237,190,.3) }
}
@keyframes slowGlow {
  0% { box-shadow:0 0 5px rgba(255,73,91,.2) }
  50% { box-shadow:0 0 20px rgba(255,73,91,.5) }
  100% { box-shadow:0 0 5px rgba(255,73,91,.2) }
}
@keyframes neonTrail {
  0% { opacity:1;width:0 }
  100% { opacity:0;width:60px }
}
@keyframes finalLapFlash {
  0%,100% { border-color:#FFD458 }
  50% { border-color:#FF495B }
}
@keyframes finalLapBg {
  0%,100% { background-color:rgba(255,73,91,.02) }
  50% { background-color:rgba(255,73,91,.08) }
}
@keyframes tickerScroll {
  0% { transform:translateX(0) }
  100% { transform:translateX(-50%) }
}
@keyframes fadeSlideUp {
  from { opacity:0;transform:translateY(16px) }
  to { opacity:1;transform:translateY(0) }
}
@keyframes confetti {
  0% { transform:translateY(-10px) rotate(0deg);opacity:1 }
  100% { transform:translateY(100vh) rotate(720deg);opacity:0 }
}
@keyframes podiumRise {
  from { transform:scaleY(0);transform-origin:bottom }
  to { transform:scaleY(1);transform-origin:bottom }
}
@keyframes avatarBob {
  0%,100% { transform:translateY(0) }
  50% { transform:translateY(-4px) }
}
@keyframes dustCloud {
  0% { opacity:.8;transform:scale(1) translateX(0) }
  100% { opacity:0;transform:scale(2.5) translateX(-30px) }
}
@keyframes trackMarkings {
  0% { background-position: 0 0 }
  100% { background-position: -60px 0 }
}
`;

/** Inject derby keyframes into document head (idempotent) */
export const injectDerbyStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('chartvolt-derby-css')) return;
  const style = document.createElement('style');
  style.id = 'chartvolt-derby-css';
  style.textContent = ARENA_KEYFRAMES;
  document.head.appendChild(style);
};
