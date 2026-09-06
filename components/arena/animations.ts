// ─── Arena CSS Animations — Premium Derby Effects ─────────────────────────────
// Injected once into <head> on mount

export const ARENA_KEYFRAMES = `
/* ─── Core Pulses ─── */
@keyframes derbyPulse {
  0%,100% { opacity:1 }
  50% { opacity:.5 }
}
@keyframes livePulse {
  0% { box-shadow: 0 0 0 0 rgba(15,237,190,.4) }
  70% { box-shadow: 0 0 0 8px rgba(15,237,190,0) }
  100% { box-shadow: 0 0 0 0 rgba(15,237,190,0) }
}
@keyframes liveGlow {
  0%,100% { opacity:.7; filter: brightness(1) }
  50% { opacity:1; filter: brightness(1.4) }
}
@keyframes statFlash {
  0% { background: rgba(15,237,190,.25) }
  100% { background: transparent }
}
@keyframes statFlashRed {
  0% { background: rgba(255,73,91,.25) }
  100% { background: transparent }
}

/* ─── Shine & Shimmer ─── */
@keyframes derbyShine {
  0% { background-position:-200% center }
  100% { background-position:200% center }
}
@keyframes shimmer {
  0% { background-position: -200% 0 }
  100% { background-position: 200% 0 }
}
@keyframes borderGlow {
  0%,100% { border-color: rgba(255,212,88,.2) }
  50% { border-color: rgba(255,212,88,.5) }
}
@keyframes glassShine {
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}

/* ─── Race Animations ─── */
@keyframes derbyRun {
  0%,100% { transform: translate(-50%,-50%) translateY(0) }
  50% { transform: translate(-50%,-50%) translateY(-3px) }
}
@keyframes derbyRunFast {
  0% { transform: translate(-50%,-50%) translateY(0) scale(1) }
  25% { transform: translate(-50%,-50%) translateY(-4px) scale(1.1) }
  50% { transform: translate(-50%,-50%) translateY(0) scale(1) }
  75% { transform: translate(-50%,-50%) translateY(3px) scale(.95) }
  100% { transform: translate(-50%,-50%) translateY(0) scale(1) }
}
@keyframes neonTrail {
  0% { opacity:1;width:0 }
  100% { opacity:0;width:80px }
}
@keyframes neonTrailGlow {
  0% { opacity: .8; box-shadow: 0 0 8px rgba(15,237,190,.6) }
  100% { opacity: 0; box-shadow: 0 0 0 transparent }
}
@keyframes trackMarkings {
  0% { background-position: 0 0 }
  100% { background-position: -60px 0 }
}
@keyframes dustCloud {
  0% { opacity:.8;transform:scale(1) translateX(0) }
  100% { opacity:0;transform:scale(3) translateX(-40px) }
}
@keyframes speedLines {
  0% { opacity:0; transform: translateX(20px) }
  30% { opacity:.6 }
  100% { opacity:0; transform: translateX(-60px) }
}

/* ─── Boost & Glow ─── */
@keyframes boostGlow {
  0% { box-shadow:0 0 10px rgba(15,237,190,.3) }
  50% { box-shadow:0 0 40px rgba(15,237,190,.8),0 0 80px rgba(15,237,190,.3) }
  100% { box-shadow:0 0 10px rgba(15,237,190,.3) }
}
@keyframes slowGlow {
  0% { box-shadow:0 0 5px rgba(255,73,91,.2) }
  50% { box-shadow:0 0 25px rgba(255,73,91,.6) }
  100% { box-shadow:0 0 5px rgba(255,73,91,.2) }
}
@keyframes goldGlow {
  0%,100% { box-shadow: 0 0 15px rgba(255,212,88,.2) }
  50% { box-shadow: 0 0 30px rgba(255,212,88,.5), 0 0 60px rgba(255,212,88,.15) }
}

/* ─── Final Lap ─── */
@keyframes finalLapFlash {
  0%,100% { border-color:#FFD458 }
  50% { border-color:#FF495B }
}
@keyframes finalLapBg {
  0%,100% { background-color:rgba(255,73,91,.02) }
  50% { background-color:rgba(255,73,91,.1) }
}

/* ─── Price Ticker ─── */
@keyframes tickerScroll {
  0% { transform:translateX(0) }
  100% { transform:translateX(-50%) }
}
@keyframes priceUp {
  0% { color: #0FEDBE; text-shadow: 0 0 12px rgba(15,237,190,.6) }
  100% { color: #0FEDBE; text-shadow: none }
}
@keyframes priceDown {
  0% { color: #FF495B; text-shadow: 0 0 12px rgba(255,73,91,.6) }
  100% { color: #FF495B; text-shadow: none }
}

/* ─── Transitions ─── */
@keyframes fadeSlideUp {
  from { opacity:0;transform:translateY(20px) }
  to { opacity:1;transform:translateY(0) }
}
@keyframes fadeIn {
  from { opacity:0 }
  to { opacity:1 }
}
@keyframes scaleIn {
  from { transform: scale(.95); opacity:0 }
  to { transform: scale(1); opacity:1 }
}

/* ─── Podium ─── */
@keyframes confetti {
  0% { transform:translateY(-10px) rotate(0deg);opacity:1 }
  100% { transform:translateY(100vh) rotate(720deg);opacity:0 }
}
@keyframes podiumRise {
  from { transform:scaleY(0);transform-origin:bottom }
  to { transform:scaleY(1);transform-origin:bottom }
}

/* ─── Avatar ─── */
@keyframes avatarBob {
  0%,100% { transform:translateY(0) }
  50% { transform:translateY(-5px) }
}
@keyframes avatarRing {
  0% { transform: rotate(0deg) }
  100% { transform: rotate(360deg) }
}
@keyframes avatarPulse {
  0%,100% { transform: scale(1) }
  50% { transform: scale(1.05) }
}

/* ─── Glow Pulse ─── */
@keyframes glowPulse {
  0%,100% { opacity:.8; filter: brightness(1) }
  50% { opacity:1; filter: brightness(1.3) }
}

/* ─── Text Effects ─── */
@keyframes textShine {
  0%,100% { opacity:1; filter: brightness(1) }
  50% { opacity:.9; filter: brightness(1.2) }
}

/* ─── Slide Transitions ─── */
@keyframes slideInFromLeft {
  from { opacity:0; transform: translateX(-30px) }
  to { opacity:1; transform: translateX(0) }
}
@keyframes slideInFromRight {
  from { opacity:0; transform: translateX(30px) }
  to { opacity:1; transform: translateX(0) }
}
@keyframes slideInFromBottom {
  from { opacity:0; transform: translateY(30px) }
  to { opacity:1; transform: translateY(0) }
}
@keyframes scaleUp {
  from { transform: scale(.9); opacity:0 }
  to { transform: scale(1); opacity:1 }
}

/* ─── Gradient Background ─── */
@keyframes gradientShift {
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}

/* ─── Particle Float ─── */
@keyframes particleFloat {
  0% { transform: translateY(0) translateX(0); opacity:.3 }
  50% { transform: translateY(-20px) translateX(10px); opacity:.6 }
  100% { transform: translateY(0) translateX(0); opacity:.3 }
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
