
(() => {
  "use strict";

  // Chartvolt Neon Stack 7.0
  // Competitive block-stacking engine with guideline-inspired movement,
  // SRS-style kicks, lock delay, DAS/ARR, T-spin detection, B2B/combo scoring,
  // visual effects, WebAudio feedback and competition telemetry hooks.

  const COLS = 10;
  const VISIBLE_ROWS = 20;
  const HIDDEN_ROWS = 4;
  const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
  const FIXED_STEP_MS = 1000 / 60;
  const LOCK_DELAY_MS = 500;
  const DAS_MS = 135;
  const ARR_MS = 34;
  const SOFT_DROP_MS = 34;
  const CLEAR_ANIMATION_MS = 280;
  const COLLAPSE_ANIMATION_MS = 135;
  const COUNTDOWN_MS = 3000;
  const TOP_OUT_BUFFER_ROWS = HIDDEN_ROWS;
  const HARD_DROP_POINTS_PER_CELL = 2;
  const SOFT_DROP_POINTS_PER_CELL = 0; // Chartvolt rule: Arrow Down never farms score.
  const DEFAULT_COMPETITION_DURATION_MS = 2 * 60 * 1000;

  const COLORS = {
    I: "#00EFFF",
    J: "#3165FF",
    L: "#FF8A00",
    O: "#FFDC00",
    S: "#37FF32",
    T: "#AC32FF",
    Z: "#FF238A"
  };

  let liveStandings = [];
  let standingsBusy = false;
  let roomId = "";
  let playersLiveCount = 0;
  let playerName = "Player";
  let playerInitials = "MA";
  let leaderboardPollAt = 0;

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };

  // SRS kick tables. Coordinates use x right+, y down+; values below are converted from guideline y-up notation.
  const JLSTZ_KICKS = {
    "0>1": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "1>0": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    "1>2": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    "2>1": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "2>3": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    "3>2": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "3>0": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "0>3": [[0,0],[1,0],[1,-1],[0,2],[1,2]]
  };
  const I_KICKS = {
    "0>1": [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    "1>0": [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    "1>2": [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    "2>1": [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    "2>3": [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    "3>2": [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    "3>0": [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    "0>3": [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  };

  const SCORE = {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800,
    tspinMini0: 100,
    tspin0: 400,
    tspinMini1: 200,
    tspin1: 800,
    tspin2: 1200,
    tspin3: 1600,
    perfectClearSingle: 800,
    perfectClearDouble: 1200,
    perfectClearTriple: 1800,
    perfectClearTetris: 2000,
    perfectClearB2BTetris: 3200
  };


  const LEVEL_THEMES = [
    {min:1,max:3,name:"VOLT STACK",primary:"#55F6FF",secondary:"#3974FF",accent:"#B36BFF",warm:"#FF69CE",root:130.81},
    {min:4,max:6,name:"PRISM PULSE",primary:"#B86DFF",secondary:"#FF62D7",accent:"#55E7FF",warm:"#FFB14A",root:146.83},
    {min:7,max:9,name:"SOLAR RUSH",primary:"#FFD454",secondary:"#FF7A45",accent:"#FF4F87",warm:"#7CFF65",root:164.81},
    {min:10,max:14,name:"HYPER SPECTRUM",primary:"#65FFB7",secondary:"#5DE8FF",accent:"#C76CFF",warm:"#FFE45C",root:174.61},
    {min:15,max:21,name:"REACTOR OVERDRIVE",primary:"#FF6B72",secondary:"#FFB13D",accent:"#D85EFF",warm:"#6CFFF1",root:196.00},
    {min:22,max:999,name:"SINGULARITY",primary:"#F5F7FF",secondary:"#7D63FF",accent:"#FF4BC7",warm:"#65F7FF",root:220.00}
  ];

  const MILESTONE_RULES = [
    {key:"lines25",type:"lines",value:25,label:"25 LINES",bonus:500},
    {key:"lines50",type:"lines",value:50,label:"50 LINES",bonus:1200},
    {key:"lines100",type:"lines",value:100,label:"100 LINES",bonus:3000},
    {key:"level5",type:"level",value:5,label:"LEVEL 5",bonus:700},
    {key:"level10",type:"level",value:10,label:"LEVEL 10",bonus:1800},
    {key:"level15",type:"level",value:15,label:"LEVEL 15",bonus:3500},
    {key:"level20",type:"level",value:20,label:"LEVEL 20",bonus:6000}
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const fxCanvas = document.getElementById("fxCanvas");
  const fx = fxCanvas.getContext("2d");
  const holdCanvas = document.getElementById("holdCanvas");
  const holdCtx = holdCanvas.getContext("2d");
  const nextCanvas = document.getElementById("nextCanvas");
  const nextCtx = nextCanvas.getContext("2d");

  const ui = Object.fromEntries([
    "score","lines","level","combo","progressText","levelProgress","speedLabel",
    "competitionTimer","mobileCompetitionTimer","rankChip","mobileRank","leaderboard",
    "livePill","liveText","startOverlay","pauseOverlay","gameOverOverlay","startBtn",
    "resumeBtn","restartBtn","pauseBtn","soundBtn","soundIcon","finalScore","bestScore",
    "finalLines","finalLevel","resultTitle","resultKicker","resultRank","floatingEvent",
    "gameStage","sessionShort","sessionShortMobile","integrityStatus","integrityStatusMobile","integrityDot","integrityDotMobile","streakText","roomId","roomIdMeta","playersLive","countdownDisplay","comboBanner","comboChain","comboSub","comboMeterFill","themeChip","menuThemeName","achievementToast","achievementTitle","achievementSub","finalMaxCombo","finalTetrises","finalTSpins","finalPerfects","finalPieces","finalPps","finalAchievements"
  ].map(id => [id, document.getElementById(id)]));

  const safeStorage={getItem(key){try{return localStorage.getItem(key)}catch{return null}},setItem(key,value){try{localStorage.setItem(key,value)}catch{}}};
  let starting=false, finishing=false, matchEndsAt=0;
  let board = makeEmptyBoard();
  let active = null;
  let bag = [];
  let queue = [];
  let pieceSeed = "chartvolt-offline";
  let rngState = 0x6d2b79f5;
  let holdType = null;
  let holdLocked = false;

  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = -1;
  let backToBack = false;
  let best = Number(safeStorage.getItem("chartvolt-neon-stack-best") || 0);
  let ranking = null;
  let maxCombo = 0;
  let bestComboEver = Number(safeStorage.getItem("chartvolt-neon-stack-best-combo") || 0);
  let comboChainsRegistered = 0;
  let comboHeat = 0;
  let displayScore = 0;
  let currentTheme = LEVEL_THEMES[0];
  let awardedMilestones = new Set();
  let awardedAchievements = new Set();
  let achievementQueue = [];
  let achievementBusy = false;
  let runStats = makeRunStats();

  let state = "ready"; // ready | countdown | playing | clearing | collapsing | paused | over
  let clearState = null;
  let collapseState = null;
  let countdownState = null;
  let pausedFromState = "playing";
  let bufferedRotation = 0; // IRS during clear delay.
  let bufferedHold = false; // IHS during clear delay.
  let lastFrame = performance.now();
  let simulationAccumulator = 0;
  let simulationTimeMs = 0;
  let gameStep = 0;
  let renderDeltaSec = 1/60;
  let gravityAccumulator = 0;
  let lockAccumulator = 0;
  let lockStarted = false;
  let grounded = false;
  let lastMoveWasRotation = false;
  let lastKickIndex = 0;
  let elapsedCompetition = 0;
  let competitionDurationMs = DEFAULT_COMPETITION_DURATION_MS;
  let competitionEndsAt = 0;
  let levelTimerStartStep = 0;

  let particles = [];
  let sparks = [];
  let lineFlashes = [];
  let trails = [];
  let ambientDust = [];
  let boardPulse = 0;
  let flashPulse = 0;
  let coachAdvice = "Tactical engine online";
  let dangerLevel = 0;
  let boardShaderTime = 0;

  let soundEnabled = true;
  let musicVolume = 1.0;
  let dangerSoundState = 0;
  let finalTenTriggered = false;
  let newPersonalBest = false;
  const blockSpriteCache = new Map();
  const shockwaves = [];
  const energyArcs = [];

  const controlConfig = { dasMs: 120, arrMs: 28, softDropMs: 28, instantArr: false };
  const replay = { recording:true, playing:false, inputs:[], source:null, cursor:0, finalStep:0 };
  let replayInitialSeed = pieceSeed;
  let visualPose = { type:null, x:0, y:0, rotationOffset:0, scaleY:1, impact:0 };
  let qualityTier = 2; // 2 high, 1 medium, 0 low
  let autoQuality = true;
  let fpsSamples = [];
  let lastQualityCheck = performance.now();
  let gamepadPrev = null;


  const pressed = new Set();
  let horizontalPriority = null;
  const held = {
    left: { down:false, started:0, repeat:0 },
    right:{ down:false, started:0, repeat:0 },
    down: { down:false, started:0, repeat:0 }
  };

  const telemetry = {
    sessionId: null,
    sequence: 0,
    chain: "GENESIS",
    serverToken: null,
    serverSessionId: null,
    startTime: 0,
    inputCount: 0,
    impossibleFlags: 0,
    lastScore: 0,
    pending: Promise.resolve()
  };

  function makeRunStats() {
    return {pieces:0,singles:0,doubles:0,triples:0,tetrises:0,tspins:0,tspinMinis:0,perfectClears:0,hardDrops:0,hardDropCells:0,maxB2B:0,currentB2B:0,noHoleStreak:0,milestoneBonus:0,startMs:0};
  }

  function themeForLevel(lvl=level) {
    return LEVEL_THEMES.find(t=>lvl>=t.min&&lvl<=t.max) || LEVEL_THEMES[LEVEL_THEMES.length-1];
  }

  function applyLevelTheme(force=false) {
    const next=themeForLevel(level);
    if(!force && currentTheme===next) return;
    currentTheme=next;
    const root=document.documentElement;
    root.style.setProperty("--level-primary",next.primary);
    root.style.setProperty("--level-secondary",next.secondary);
    root.style.setProperty("--level-accent",next.accent);
    root.style.setProperty("--level-warm",next.warm);
    document.body.dataset.levelTheme=next.name.toLowerCase().replace(/\s+/g,"-");
    if(ui.themeChip)ui.themeChip.textContent=next.name;
    if(ui.menuThemeName)ui.menuThemeName.textContent=next.name;
    blockSpriteCache.clear();
  }

  function updateAnimatedScore(dt) {
    if(Math.abs(score-displayScore)<.6){displayScore=score;return;}
    const diff=score-displayScore;
    const rate=1-Math.exp(-(Math.abs(diff)>5000?15:Math.abs(diff)>1000?11:8)*dt);
    displayScore += diff*rate;
  }

  function showAchievementNow(item){
    if(!ui.achievementToast)return;
    achievementBusy=true;
    ui.achievementTitle.textContent=item.title;
    ui.achievementSub.textContent=item.sub||"UNLOCKED";
    ui.achievementToast.classList.remove("show");void ui.achievementToast.offsetWidth;ui.achievementToast.classList.add("show");
    triggerCenterBlast(item.color||currentTheme.accent,.72);
    sfx("achievement");
    setTimeout(()=>{ui.achievementToast.classList.remove("show");achievementBusy=false;const next=achievementQueue.shift();if(next)setTimeout(()=>showAchievementNow(next),120);},1850);
  }

  function unlockAchievement(key,title,sub="UNLOCKED",color=null){
    if(awardedAchievements.has(key))return false;
    awardedAchievements.add(key);
    const item={key,title,sub,color};
    if(achievementBusy)achievementQueue.push(item);else showAchievementNow(item);
    emitGameEvent("achievement_unlock",{achievement:key,title,sub});
    return true;
  }

  function checkMilestoneBonuses(){
    let bonus=0;
    for(const rule of MILESTONE_RULES){
      if(awardedMilestones.has(rule.key))continue;
      const reached=rule.type==="lines"?lines>=rule.value:level>=rule.value;
      if(!reached)continue;
      awardedMilestones.add(rule.key);
      const award=rule.bonus*Math.max(1,Math.floor(level/3));
      bonus+=award;runStats.milestoneBonus+=award;
      unlockAchievement(`milestone-${rule.key}`,rule.label,`+${award.toLocaleString()} MILESTONE BONUS`,currentTheme.warm);
      emitGameEvent("milestone",{milestone:rule.key,label:rule.label,bonus:award,score,lines,level});
    }
    return bonus;
  }

  function checkRunAchievements(clearCount,spin,perfectClear){
    if(clearCount===4)unlockAchievement("first-tetris","FIRST TETRIS","POWER CLEAR REGISTERED","#55F6FF");
    if(clearCount===3)unlockAchievement("first-triple","TRIPLE THREAT","3 LINES AT ONCE","#FFD454");
    if(spin.tspin){unlockAchievement("first-tspin","T-SPIN MASTER","TECHNICAL CLEAR","#B86DFF");if(runStats.tspins>=3)unlockAchievement("tspin-3","T-SPIN SPECIALIST","3 T-SPINS REGISTERED","#FF62D7");}
    if(perfectClear)unlockAchievement("perfect-clear","PERFECT CLEAR","BOARD COMPLETELY CLEAN","#CFFF77");
    if(maxCombo>=3)unlockAchievement("combo-3","COMBO IGNITION","x3 CLEAR CHAIN","#FF77E8");
    if(maxCombo>=5)unlockAchievement("combo-5","MEGA COMBO","x5 CLEAR CHAIN","#FFB14A");
    if(maxCombo>=8)unlockAchievement("combo-8","ULTRA VOLT","x8 CLEAR CHAIN","#CFFF77");
    if(level>=5)unlockAchievement("reach-level-5","LEVEL 5 REACHED",currentTheme.name,currentTheme.primary);
    if(level>=10)unlockAchievement("reach-level-10","LEVEL 10 REACHED","HYPER MODE",currentTheme.accent);
    if(level>=15)unlockAchievement("reach-level-15","LEVEL 15 REACHED","REACTOR MODE",currentTheme.warm);
    if(level>=22)unlockAchievement("reach-20g","20G SURVIVOR","SINGULARITY GRAVITY",currentTheme.primary);
    if(score>=10000)unlockAchievement("score-10k","10K SCORE","SCORE MILESTONE",currentTheme.primary);
    if(score>=50000)unlockAchievement("score-50k","50K SCORE","SCORE MILESTONE",currentTheme.warm);
    if(score>=100000)unlockAchievement("score-100k","100K SCORE","ELITE SCORE",currentTheme.accent);
    if(runStats.noHoleStreak>=5)unlockAchievement("no-hole-5","CLEAN STACK","5 LOCKS WITHOUT A HOLE","#65FFB7");
  }

  function syncRoomMeta() {
    if (ui.roomId) ui.roomId.textContent = roomId;
    if (ui.roomIdMeta) ui.roomIdMeta.textContent = roomId;
    if (ui.playersLive) ui.playersLive.textContent = `${playersLiveCount} players`;
  }

  function initialiseOfflineStandings(){liveStandings=[];}
  function updateOfflineStandings(){}
  async function refreshLiveStandings(){/* Rankings belong to the host arena. */}
  function makeEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function setPieceSeed(seed) {
    pieceSeed = String(seed || "chartvolt-offline");
    let h = 2166136261 >>> 0;
    for (let i=0;i<pieceSeed.length;i++) {
      h ^= pieceSeed.charCodeAt(i);
      h = Math.imul(h,16777619) >>> 0;
    }
    rngState = h || 0x6d2b79f5;
  }

  function pieceRandom() {
    // xorshift32: deterministic and fast; used only for gameplay-piece order.
    let x = rngState >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    rngState = x >>> 0;
    return (rngState >>> 0) / 4294967296;
  }


function recordReplayInput(action, phase = "tap") {
  if (!replay.recording || replay.playing || state === "ready" || state === "countdown") return;
  replay.inputs.push({ step: gameStep + 1, action, phase });
}

function exportReplay() {
  return {
    version: 1,
    engine: "CV-GAME 9.6",
    seed: replayInitialSeed,
    controls: { ...controlConfig },
    durationMs: competitionDurationMs,
    inputs: replay.inputs.map(v => ({ ...v })),
    final: { score, lines, level, gameStep, backToBack, combo }
  };
}

function applyReplayEventsForStep() {
  if (!replay.playing || !replay.source) return;
  const list = replay.source.inputs || [];
  while (replay.cursor < list.length && list[replay.cursor].step <= gameStep) {
    const evt = list[replay.cursor++];
    processReplayAction(evt.action, evt.phase);
  }
}


function processReplayAction(action, phase) {
  if (action === "left") phase === "up" ? directionUp("left",false) : directionDown("left",false);
  else if (action === "right") phase === "up" ? directionUp("right",false) : directionDown("right",false);
  else if (action === "down") phase === "up" ? directionUp("down",false) : directionDown("down",false);
  else if (phase === "tap" && action === "rotateCW") { if(!bufferOrAct("rotateCW",false)&&canPlay()) rotate(1, false); }
  else if (phase === "tap" && action === "rotateCCW") { if(!bufferOrAct("rotateCCW",false)&&canPlay()) rotate(-1, false); }
  else if (phase === "tap" && action === "hardDrop" && canPlay()) hardDrop(false);
  else if (phase === "tap" && action === "hold") { if(!bufferOrAct("hold",false)&&canPlay()) hold(false); }
}

  function shuffledBag() {
    const a = Object.keys(SHAPES);
    for (let i=a.length-1;i>0;i--) {
      const j = Math.floor(pieceRandom()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function nextType() {
    if (!bag.length) bag = shuffledBag();
    return bag.pop();
  }

  function refillQueue() {
    while (queue.length < 6) queue.push(nextType());
  }

  function cloneMatrix(m) { return m.map(r => r.slice()); }

  function makePiece(type) {
    const matrix = cloneMatrix(SHAPES[type]);
    const x = type === "O" ? 4 : Math.floor((COLS - matrix[0].length) / 2);
    // Spawn in the buffer with the lower minos immediately visible at the top edge.
    const y = HIDDEN_ROWS - 1;
    return { type, matrix, rotation:0, x, y, spawnY:y };
  }

  function spawn(type = null, fromHold = false) {
    refillQueue();
    const pieceType = type || queue.shift();
    refillQueue();
    active = makePiece(pieceType);
    holdLocked = fromHold ? true : false;
    grounded = false;
    lockAccumulator = 0;
    lockStarted = false;
    lastMoveWasRotation = false;
    lastKickIndex = 0;
    if (collides(active.matrix, active.x, active.y)) {
      finishGame("GAME OVER", "BLOCK OUT");
      return false;
    }
    visualPose.type = active.type;
    visualPose.x = active.x;
    visualPose.y = active.y;
    visualPose.rotationOffset = 0;
    visualPose.scaleY = 1;
    visualPose.impact = 0;
    pulseMini(nextCanvas, "queue-pulse");
    renderSideCanvases();
    return true;
  }


  function pulseMini(el, cls) {
    if (!el) return;
    const target = cls === "swap-pulse" ? el.closest(".hold-card") : el;
    if (!target) return;
    target.classList.remove(cls);
    void target.offsetWidth;
    target.classList.add(cls);
  }

  function collides(matrix, ox, oy) {
    for (let y=0;y<matrix.length;y++) for (let x=0;x<matrix[y].length;x++) {
      if (!matrix[y][x]) continue;
      const bx = ox+x, by=oy+y;
      if (bx<0 || bx>=COLS || by>=ROWS) return true;
      if (by>=0 && board[by][bx]) return true;
    }
    return false;
  }

  function rotateMatrix(matrix, dir) {
    const n=matrix.length;
    const out=Array.from({length:n},()=>Array(n).fill(0));
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
      if (dir>0) out[x][n-1-y]=matrix[y][x];
      else out[n-1-x][y]=matrix[y][x];
    }
    return out;
  }

  function kickTableFor(type, from, to) {
    if (type === "O") return [[0,0]];
    return (type === "I" ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`] || [[0,0]];
  }

  function rotate(dir=1, shouldRecord=true) {
    if (!canPlay()) return;
    telemetry.inputCount++;
    if (shouldRecord) recordReplayInput(dir>0?"rotateCW":"rotateCCW");
    if (active.type === "O") { sfx("rotate"); return; }
    trackGroundContact();
    const from=active.rotation;
    const to=(from + (dir>0?1:3))%4;
    const rotated=rotateMatrix(active.matrix,dir);
    const kicks=kickTableFor(active.type,from,to);
    for (let i=0;i<kicks.length;i++) {
      const [kx,ky]=kicks[i];
      if (!collides(rotated,active.x+kx,active.y+ky)) {
        active.matrix=rotated; active.rotation=to; active.x+=kx; active.y+=ky;
        lastMoveWasRotation=true; lastKickIndex=i;
        visualPose.rotationOffset += dir>0 ? -Math.PI/2 : Math.PI/2;
        trackGroundContact();
        sfx(i>0?"wallKick":"rotate");
        emitGameEvent("rotate", {type:active.type,rotation:to,kick:i});
        return;
      }
    }
  }

  function tryMove(dx,dy,soft=false) {
    if (!canPlay()) return false;
    trackGroundContact();
    if (!collides(active.matrix,active.x+dx,active.y+dy)) {
      active.x+=dx; active.y+=dy;
      telemetry.inputCount++;
      lastMoveWasRotation=false;
      if (soft && dy>0) score += SOFT_DROP_POINTS_PER_CELL;
      if (dx!==0) { addMotionTrail(dx); trackGroundContact(); sfx("move"); }
      trackGroundContact();
      syncUi();
      return true;
    }
    return false;
  }

  // First contact starts a per-piece budget. Kicks, movement and pause/resume
  // must never refresh it; even a kick off a ledge keeps the same budget.
  function trackGroundContact() {
    if (!active) return;
    grounded = collides(active.matrix, active.x, active.y+1);
    if (grounded) lockStarted = true;
  }

  function hardDrop(shouldRecord=true) {
    if (!canPlay()) return;
    telemetry.inputCount++;
    if (shouldRecord) recordReplayInput("hardDrop");
    runStats.hardDrops++;
    const target=ghostY();
    const distance=Math.max(0,target-active.y);
    runStats.hardDropCells+=distance;
    if (distance>0) {
      addDropTrail(active.y,target);
      active.y=target;
      score += distance*HARD_DROP_POINTS_PER_CELL;
    }
    visualPose.impact=1;
    addImpactRipple(active.x + active.matrix.length/2, target - HIDDEN_ROWS + active.matrix.length/2, COLORS[active.type], Math.max(1,distance));
    if(distance>=8)triggerCenterBlast(COLORS[active.type],Math.min(1.3,.45+distance*.07));
    sfx("hardDrop");
    lockPiece(true);
  }

  function ghostY() {
    if (!active) return 0;
    let y=active.y;
    while (!collides(active.matrix,active.x,y+1)) y++;
    return y;
  }

  function hold(shouldRecord=true) {
    if (!canPlay() || holdLocked) return;
    // Hold creates a new active tetromino, so soft drop must require a new press.
    disarmSoftDropCarryover();
    telemetry.inputCount++;
    if (shouldRecord) recordReplayInput("hold");
    const outgoing=active.type;
    if (holdType) {
      const incoming=holdType;
      holdType=outgoing;
      active=makePiece(incoming);
      if (collides(active.matrix,active.x,active.y)) { finishGame("GAME OVER","NO SPAWN SPACE"); return; }
    } else {
      holdType=outgoing;
      refillQueue();
      active=makePiece(queue.shift());
      refillQueue();
    }
    holdLocked=true;
    visualPose.type=null;
    grounded=false;lockAccumulator=0;lockStarted=false;lastMoveWasRotation=false;
    sfx("hold");
    pulseMini(holdCanvas,"swap-pulse");
    pulseMini(nextCanvas,"queue-pulse");
    renderSideCanvases();
    emitGameEvent("hold", {held:holdType,active:active.type});
  }

  function occupiedCorner(x,y) {
    if (x<0 || x>=COLS || y<0 || y>=ROWS) return true;
    return Boolean(board[y][x]);
  }

  function detectTSpin() {
    if (!active || active.type!=="T" || !lastMoveWasRotation) return {tspin:false,mini:false};
    const cx=active.x+1, cy=active.y+1;
    const corners=[occupiedCorner(cx-1,cy-1),occupiedCorner(cx+1,cy-1),occupiedCorner(cx-1,cy+1),occupiedCorner(cx+1,cy+1)];
    const filled=corners.filter(Boolean).length;
    if (filled<3) return {tspin:false,mini:false};
    const frontByRot={
      0:[0,1], 1:[1,3], 2:[2,3], 3:[0,2]
    }[active.rotation];
    const frontFilled=(corners[frontByRot[0]]?1:0)+(corners[frontByRot[1]]?1:0);
    const mini=frontFilled<2 && lastKickIndex!==4;
    return {tspin:true,mini};
  }



function lockPiece(hard=false) {
  if (!active || state!=="playing") return;

  // Never let a held soft-drop command spill into the next piece.
  disarmSoftDropCarryover();

  const pieceType = active.type;
  const scoringLevel = level;
  const spin = detectTSpin();
  const lockedCells=[];

  for (let y=0;y<active.matrix.length;y++) for (let x=0;x<active.matrix[y].length;x++) {
    if (!active.matrix[y][x]) continue;
    const by=active.y+y,bx=active.x+x;
    if (by<0) { finishGame("GAME OVER","LOCK OUT"); return; }
    if (by<ROWS && bx>=0 && bx<COLS) {
      board[by][bx]=pieceType;
      lockedCells.push({x:bx,y:by,type:pieceType});
    }
  }

  addLockBurst(lockedCells,hard);

  const clearedRows=findFullRows();
  const clearCount=clearedRows.length;
  runStats.pieces++;
  if(clearCount===1)runStats.singles++;else if(clearCount===2)runStats.doubles++;else if(clearCount===3)runStats.triples++;else if(clearCount===4)runStats.tetrises++;
  if(spin.tspin){runStats.tspins++;if(spin.mini)runStats.tspinMinis++;}
  const scoring=scoreClear(clearCount,spin);
  const previousBackToBack=backToBack;
  const qualifiesB2B=Boolean(scoring.difficult && clearCount>0);

  if (clearCount>0) combo++;
  else combo=-1;

  const basePoints = scoring.base * scoringLevel;
  const backToBackBonus = qualifiesB2B && previousBackToBack
    ? Math.round(basePoints * .5)
    : 0;
  const comboBonus = clearCount>0 && combo>0
    ? 50 * combo * scoringLevel
    : 0;

  const perfectClear = clearCount>0 && isPerfectClearAfter(clearedRows);
  let perfectClearBonus = 0;
  if (perfectClear) {
    if (clearCount===1) perfectClearBonus = SCORE.perfectClearSingle * scoringLevel;
    else if (clearCount===2) perfectClearBonus = SCORE.perfectClearDouble * scoringLevel;
    else if (clearCount===3) perfectClearBonus = SCORE.perfectClearTriple * scoringLevel;
    else if (clearCount===4) perfectClearBonus = (previousBackToBack ? SCORE.perfectClearB2BTetris : SCORE.perfectClearTetris) * scoringLevel;
  }

  let gained = basePoints + backToBackBonus + comboBonus + perfectClearBonus;
  if(perfectClear)runStats.perfectClears++;
  score += gained;

  if (clearCount>0) {
    if (qualifiesB2B){backToBack=true;runStats.currentB2B++;runStats.maxB2B=Math.max(runStats.maxB2B,runStats.currentB2B);}
    else {backToBack=false;runStats.currentB2B=0;}
    lines += clearCount;
    const oldLevel=level;
    level = Math.floor(lines/10)+1;
    if (level>oldLevel) {
      applyLevelTheme();
      triggerLevelUp(level);
      resetLevelTimer("level_up");
    }
    if (combo>0) {
      const chain = combo + 1;
      maxCombo = Math.max(maxCombo, chain);
      if(chain>bestComboEver){bestComboEver=chain;safeStorage.setItem("chartvolt-neon-stack-best-combo",String(bestComboEver));}
      comboChainsRegistered += 1;
      comboHeat = Math.min(1, .34 + chain * .08);
      triggerComboCelebration(chain, pieceType, clearCount);
    } else {
      comboHeat = Math.max(comboHeat, .18 + clearCount * .05);
    }
  } else {
    comboHeat = Math.max(0, comboHeat - .22);
  }

  const milestoneBonus=checkMilestoneBonuses();
  if(milestoneBonus){score+=milestoneBonus;gained+=milestoneBonus;}
  const profileAfterLock=boardProfile();
  runStats.noHoleStreak=profileAfterLock.holes===0?runStats.noHoleStreak+1:0;
  checkRunAchievements(clearCount,spin,perfectClear);

  if (score>best) {
    newPersonalBest=true;
    best=score;
    safeStorage.setItem("chartvolt-neon-stack-best",String(best));
  }

  const bonuses=[];
  if (backToBackBonus) bonuses.push("BACK-TO-BACK +50%");
  if (comboBonus) bonuses.push(`COMBO x${combo+1}`);
  if (perfectClearBonus) bonuses.push("PERFECT CLEAR");
  const eventLabel = perfectClear ? "PERFECT CLEAR" : (scoring.label || "LOCK");
  const detail = bonuses.length
    ? `${bonuses.join(" • ")} • +${gained.toLocaleString()}`
    : (gained ? `+${gained.toLocaleString()}` : "");
  if (scoring.label || perfectClear) showFloating(eventLabel, detail);

  playClearSfx(clearCount,spin,perfectClear,backToBackBonus,combo);
  updateRanking();
  syncUi();
  emitGameEvent("piece_lock", {
    piece:pieceType,
    clearCount,
    spin,
    scoreGain:gained,
    scoreBreakdown:{base:basePoints,backToBack:backToBackBonus,combo:comboBonus,perfectClear:perfectClearBonus,milestone:milestoneBonus,level:scoringLevel},
    score,lines,level,combo,backToBack,perfectClear
  });

  // Lock-out: the entire locked tetromino remained inside the hidden spawn buffer.
  if (clearCount===0 && lockedCells.length && lockedCells.every(c=>c.y<HIDDEN_ROWS)) {
    active=null;
    finishGame("GAME OVER","LOCK OUT");
    return;
  }

  active=null;

  if (clearCount>0) {
    animateLineClear(clearedRows,pieceType);
    clearState={rows:[...clearedRows],pieceType,elapsedMs:0,duration:CLEAR_ANIMATION_MS};
    state="clearing";
    grounded=false;
    lockAccumulator=0;
    gravityAccumulator=0;
  } else {
    spawn(null,false);
    applyBufferedSpawnActions();
  }
}

function isPerfectClearAfter(rowsToRemove) {
  const removing=new Set(rowsToRemove);
  for(let y=0;y<ROWS;y++) {
    if(removing.has(y)) continue;
    if(board[y].some(Boolean)) return false;
  }
  return true;
}


function finishClearAnimation() {
  if (!clearState || state!=="clearing") return;
  const rows=[...clearState.rows].sort((a,b)=>a-b);
  const offsets=Array(ROWS).fill(0);
  for(let oldY=0;oldY<ROWS;oldY++) {
    if(rows.includes(oldY)) continue;
    const fall=rows.filter(r=>r>oldY).length;
    const newY=oldY+fall;
    if(newY>=0 && newY<ROWS) offsets[newY]=fall;
  }
  removeRows(rows);
  clearState=null;
  collapseState={elapsedMs:0,duration:COLLAPSE_ANIMATION_MS,offsets};
  state="collapsing";
  gravityAccumulator=0;
  lockAccumulator=0;
  grounded=false;
}

function finishCollapseAnimation() {
  if(!collapseState || state!=="collapsing") return;
  collapseState=null;
  state="playing";
  gravityAccumulator=0;
  lockAccumulator=0;
  grounded=false;
  spawn(null,false);
  applyBufferedSpawnActions();
}

function applyBufferedSpawnActions() {
  if (!active || state!=="playing") {
    bufferedRotation=0;
    bufferedHold=false;
    return;
  }
  const doHold=bufferedHold;
  const rotateDir=bufferedRotation;
  bufferedHold=false;
  bufferedRotation=0;
  if (doHold && canPlay()) hold(false);
  if (rotateDir && canPlay()) rotate(rotateDir,false);
}

  function scoreClear(n, spin) {
    if (spin.tspin) {
      if (n===0) return {base:spin.mini?SCORE.tspinMini0:SCORE.tspin0,label:spin.mini?"T-SPIN MINI":"T-SPIN",difficult:false};
      if (n===1) return {base:spin.mini?SCORE.tspinMini1:SCORE.tspin1,label:spin.mini?"T-SPIN MINI SINGLE":"T-SPIN SINGLE",difficult:true};
      if (n===2) return {base:SCORE.tspin2,label:"T-SPIN DOUBLE",difficult:true};
      return {base:SCORE.tspin3,label:"T-SPIN TRIPLE",difficult:true};
    }
    if (n===1) return {base:SCORE.single,label:"SINGLE",difficult:false};
    if (n===2) return {base:SCORE.double,label:"DOUBLE",difficult:false};
    if (n===3) return {base:SCORE.triple,label:"TRIPLE",difficult:false};
    if (n===4) return {base:SCORE.tetris,label:"TETRIS",difficult:true};
    return {base:0,label:"",difficult:false};
  }

  function findFullRows() {
    const rows=[];
    for (let y=0;y<ROWS;y++) if (board[y].every(Boolean)) rows.push(y);
    return rows;
  }
  function removeRows(rowsToRemove) {
    for (let i=rowsToRemove.length-1;i>=0;i--) board.splice(rowsToRemove[i],1);
    while (board.length<ROWS) board.unshift(Array(COLS).fill(null));
  }


function gravityRowsPerSecond() {
  // Marathon gravity with a slight competitive boost each level so the pace ramps up more aggressively.
  // 20G arrives later, giving a few more high-speed levels before instant-floor gravity kicks in.
  if (level >= 22) return Infinity;
  const l=Math.max(1,Math.min(level,21));
  const seconds=Math.pow(0.8 - (l-1)*0.007, l-1);
  const base=Math.max(1,1/Math.max(.0001,seconds));
  const boost=1 + Math.max(0,l-1)*0.055;
  return base * boost;
}

function gravityMs() {
  const rps=gravityRowsPerSecond();
  return !Number.isFinite(rps)?0:1000/rps;
}

function canPlay() { return state==="playing" && active; }

  async function prepareCompetitionSession() {
    if (typeof window.ChartvoltCompetition?.createSession !== "function") return;
    try {
      const cfg = await window.ChartvoltCompetition.createSession();
      if (!cfg) {
        telemetry.serverToken=null;
        telemetry.serverSessionId=null;
        ui.integrityStatus.textContent="Practice · local score";
        return;
      }
      if (cfg.competitionId) document.getElementById("competitionId").textContent = String(cfg.competitionId);
      if (cfg.roomId) roomId = String(cfg.roomId);
      if (cfg.livePlayers) playersLiveCount = Number(cfg.livePlayers) || playersLiveCount;
      if (cfg.playerName) {
        playerName = String(cfg.playerName);
        playerInitials = playerName.split(/\s+/).map(v => v[0]).join("").slice(0,2).toUpperCase() || "MA";
        const nameEl = document.querySelector('.player-copy strong');
        if (nameEl) nameEl.textContent = playerName;
        const avatar = document.querySelector('.avatar');
        if (avatar) avatar.textContent = playerInitials;
      }
      if (cfg.prizePool != null) {
        const v = Number(cfg.prizePool).toLocaleString();
        document.getElementById("prizePool").textContent = v;
        document.getElementById("mobilePrizePool").textContent = v;
      }
      matchEndsAt=cfg.endsAt || 0;
      if (cfg.durationMs && Number(cfg.durationMs) > 0) competitionDurationMs = Number(cfg.durationMs);
      if (cfg.pieceSeed) setPieceSeed(cfg.pieceSeed);
      telemetry.serverToken = cfg.token || null;
      telemetry.serverSessionId = cfg.sessionId || null;
      ui.integrityStatus.textContent = cfg.token ? "Host session connected" : "Local telemetry · unverified";if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent=ui.integrityStatus.textContent;
      syncRoomMeta();
    } catch (_) {
      telemetry.serverToken = null;
      telemetry.serverSessionId = null;
      ui.integrityStatus.textContent = "Connection required";if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent=ui.integrityStatus.textContent;
      syncRoomMeta();
      throw _;
    }
  }


async function resetGame(options={}) {
  if (!options || (typeof Event!=="undefined" && options instanceof Event)) options={};
  if(starting || finishing || !['ready','over'].includes(state))return;
  if(window.ChartvoltCompetition?.hasPendingResult()){document.getElementById('submissionStatus').textContent='Submit this result before starting another run.';return;}
  // Unlock within the original user gesture, before any async session work.
  initAudio();
  starting=true;ui.startBtn.disabled=true;ui.restartBtn.disabled=true;
  document.getElementById('startError').textContent='';
  await telemetry.pending;
  matchEndsAt=0;
  releaseHeldInputs();
  const replayData=options.replayData || null;
  replay.playing=Boolean(replayData);
  replay.source=replayData;
  replay.cursor=0;
  replay.finalStep=replayData?.final?.gameStep || 0;
  replay.recording=!replay.playing;

  if (!replay.playing) {
    try{await prepareCompetitionSession();}
    catch(error){starting=false;ui.startBtn.disabled=false;ui.restartBtn.disabled=false;document.getElementById('startError').textContent=error.message;document.getElementById('submissionStatus').textContent=error.message;return;}
  }
  else {
    telemetry.serverToken=null;
    telemetry.serverSessionId=null;
    if(replayData.seed) setPieceSeed(replayData.seed);
    if(replayData.controls) Object.assign(controlConfig,replayData.controls);
    ui.integrityStatus.textContent="Replay mode";
  }

  if (!telemetry.serverSessionId && !replay.playing) setPieceSeed(`offline-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  setPieceSeed(pieceSeed);
  replayInitialSeed=pieceSeed;
  if(!replay.playing) replay.inputs=[];

  board=makeEmptyBoard(); active=null; bag=[]; queue=[]; holdType=null; holdLocked=false;
  clearState=null;collapseState=null;countdownState=null;bufferedRotation=0;bufferedHold=false;
  score=0;displayScore=0;lines=0;level=1;combo=-1;backToBack=false;ranking=null;maxCombo=0;comboChainsRegistered=0;comboHeat=0;runStats=makeRunStats();awardedMilestones=new Set();awardedAchievements=new Set();achievementQueue=[];achievementBusy=false;
  gravityAccumulator=0;lockAccumulator=0;lockStarted=false;grounded=false;lastMoveWasRotation=false;lastKickIndex=0;
  simulationAccumulator=0;simulationTimeMs=0;gameStep=0;
  elapsedCompetition=0;competitionEndsAt=0;levelTimerStartStep=0;
  particles=[];sparks=[];lineFlashes=[];trails=[];shockwaves.length=0;energyArcs.length=0;
  boardPulse=0;flashPulse=0;coachAdvice="Create a clean stack";dangerLevel=0;dangerSoundState=0;boardShaderTime=0;
  finalTenTriggered=false;newPersonalBest=false;
  applyLevelTheme(true);
  refillQueue(); spawn();

  telemetry.sessionId=telemetry.serverSessionId || crypto.randomUUID?.() || `cv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  telemetry.sequence=0; telemetry.chain="GENESIS"; telemetry.startTime=0; telemetry.inputCount=0; telemetry.impossibleFlags=0; telemetry.lastScore=0;
  initialiseOfflineStandings();
  ui.sessionShort.textContent=telemetry.sessionId.slice(0,8).toUpperCase();if(ui.sessionShortMobile)ui.sessionShortMobile.textContent=telemetry.sessionId.slice(0,8).toUpperCase();
  ui.startOverlay.classList.remove("show");ui.pauseOverlay.classList.remove("show");ui.gameOverOverlay.classList.remove("show");
  ui.gameStage.classList.remove("pb-burst","level-up","time-critical","run-ended");
  syncRoomMeta();syncUi();renderLeaderboard();renderSideCanvases();
  starting=false;ui.startBtn.disabled=false;ui.restartBtn.disabled=false;
  window.VoltAudio?.reset();
  startCountdown();
  refreshLiveStandings(true);
}

function startCountdown() {
  state="countdown";
  countdownState={remainingMs:COUNTDOWN_MS,lastNumber:null};
  setStatus("STARTING");
  showCountdownNumber(3);
  sfx("countdown");
}

function showCountdownNumber(value,go=false) {
  if(!ui.countdownDisplay) return;
  ui.countdownDisplay.textContent=String(value);
  ui.countdownDisplay.classList.remove("show","go");
  void ui.countdownDisplay.offsetWidth;
  if(go) ui.countdownDisplay.classList.add("go");
  ui.countdownDisplay.classList.add("show");
  triggerCenterBlast(go?"#caff75":"#7cf6ff", go?1.15:.62);
}

function resetLevelTimer(reason="level_start") {
  elapsedCompetition=0;
  finalTenTriggered=false;
  ui.gameStage.classList.remove("time-critical");
  if(replay.playing){
    competitionEndsAt=0;
    levelTimerStartStep=gameStep;
  } else {
    competitionEndsAt=performance.now()+competitionDurationMs;
  }
  syncUi();
  if(reason==="level_up") {
    showFloating(`LEVEL ${level}`, "TIMER RESET");
    if(!replay.playing) emitGameEvent("level_timer_reset", {level,durationMs:competitionDurationMs});
  }
}

function beginPlay() {
  countdownState=null;
  state="playing";
  telemetry.startTime=Date.now();
  runStats.startMs=Date.now();
  resetLevelTimer("level_start");
  showCountdownNumber("GO",true);
  triggerCenterBlast("#caff75",1.85);
  setStatus(replay.playing?"REPLAY":"PLAYING");
  sfx("go");
  if(!replay.playing) emitGameEvent("game_start",competitionSnapshot());
}


function togglePause(force) {
  const pausable=["playing","clearing","collapsing"];
  if (!pausable.includes(state) && state!=="paused") return;
  const pause = typeof force==="boolean" ? force : state!=="paused";
  if (pause && state!=="paused") {
    pausedFromState=state;
    state="paused";
    updateAdaptiveMusic();
    releaseHeldInputs();
    ui.pauseOverlay.classList.add("show");
    setStatus("PAUSED");
    sfx("pause");
    if(!replay.playing) emitGameEvent("game_pause",competitionSnapshot());
  } else if (!pause && state==="paused") {
    state=pausedFromState || "playing";
    updateAdaptiveMusic();
    ui.pauseOverlay.classList.remove("show");
    setStatus(replay.playing?"REPLAY":"PLAYING");
    gravityAccumulator=0;
    sfx("resume");
    if(!replay.playing) emitGameEvent("game_resume",competitionSnapshot());
  }
}

  function finishGame(title="GAME OVER", kicker="RUN COMPLETE") {
    if (state==="over") return;
    state="over";
    updateAdaptiveMusic();
    if (score>best){best=score;safeStorage.setItem("chartvolt-neon-stack-best",String(best));}
    updateRanking(true);
    ui.resultTitle.textContent=title;
    ui.resultKicker.textContent=kicker;
    ui.finalScore.textContent=score.toLocaleString();
    ui.bestScore.textContent=best.toLocaleString();
    ui.finalLines.textContent=lines;
    ui.finalLevel.textContent=level;
    ui.resultRank.textContent=`#${ranking}`;
    const runSeconds=Math.max(1,(Date.now()-(runStats.startMs||Date.now()))/1000);
    if(ui.finalMaxCombo)ui.finalMaxCombo.textContent=`x${maxCombo}`;
    if(ui.finalTetrises)ui.finalTetrises.textContent=runStats.tetrises;
    if(ui.finalTSpins)ui.finalTSpins.textContent=runStats.tspins;
    if(ui.finalPerfects)ui.finalPerfects.textContent=runStats.perfectClears;
    if(ui.finalPieces)ui.finalPieces.textContent=runStats.pieces;
    if(ui.finalPps)ui.finalPps.textContent=(runStats.pieces/runSeconds).toFixed(2);
    if(ui.finalAchievements)ui.finalAchievements.textContent=`${awardedAchievements.size} unlocked • +${runStats.milestoneBonus.toLocaleString()} bonus`;
    competitionEndsAt=0;
    releaseHeldInputs();
    ui.pauseOverlay.classList.remove("show");
    ui.gameStage.classList.remove("time-critical");
    ui.gameStage.classList.add("run-ended");
    ui.gameOverOverlay.classList.add("show");
    triggerCenterBlast(newPersonalBest?"#caff75":currentTheme.accent,newPersonalBest?1.65:1.05);
    if(newPersonalBest){ui.resultKicker.textContent="NEW PERSONAL BEST";ui.gameStage.classList.add("pb-burst");sfx("personalBest");}
    setStatus(replay.playing?"REPLAY END":"GAME OVER");syncUi();renderLeaderboard();
    if(!newPersonalBest)sfx("gameover");
    if(replay.playing){replay.playing=false;replay.recording=true;return;}
    finishing=true;
    emitGameEvent("game_over",competitionSnapshot()).then(async () => {
      if (typeof window.ChartvoltCompetition?.finalize !== "function") return;
      try {
        const receipt = await window.ChartvoltCompetition.finalize(competitionSnapshot(), telemetry.serverToken);
        if (receipt?.verified === true) {
          ui.integrityStatus.textContent = "Result server verified";if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent="Result server verified";
          ui.resultKicker.textContent = "SERVER VERIFIED RESULT";
        }
      } catch (_) {
        ui.integrityStatus.textContent = "Result sync pending";if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent="Result sync pending";
      }
    }).finally(()=>{finishing=false;});
  }

  function competitionSnapshot() {
    return {
      state,score,lines,level,combo,backToBack,maxCombo,bestComboEver,comboChainsRegistered,rank:ranking,roomId,playersLive:playersLiveCount,
      timeRemainingMs:Math.max(0,competitionDurationMs-elapsedCompetition),timerMode:"per_level",levelDurationMs:competitionDurationMs,
      sessionId:telemetry.sessionId,
      stats:{...runStats,maxCombo,achievements:awardedAchievements.size},
      pieceSeed,
      integrityChain:telemetry.chain
    };
  }

  function setStatus(label) {
    ui.liveText.textContent=label;
    ui.livePill.classList.remove("playing","paused","gameover");
    if(label==="PLAYING")ui.livePill.classList.add("playing");
    else if(label==="PAUSED")ui.livePill.classList.add("paused");
    else if(label==="GAME OVER")ui.livePill.classList.add("gameover");
  }

  function syncUi() {
    ui.score.textContent=Math.round(displayScore).toLocaleString();ui.lines.textContent=lines;ui.level.textContent=level;ui.combo.textContent=combo>0?`${combo+1}`:"0";
    const p=lines%10;ui.progressText.textContent=`${p} / 10`;ui.levelProgress.style.width=`${p*10}%`;
    const base=gravityMs();ui.speedLabel.textContent=base===0?"20G":`${Math.min(99,1000/base).toFixed(1)}×`;
    ui.rankChip.textContent=`#${ranking}`;ui.mobileRank.textContent=`#${ranking}`;
    if(ui.streakText) ui.streakText.textContent = coachAdvice;
    updateComboHud();
    const remain=Math.max(0,Math.min(competitionDurationMs-elapsedCompetition,matchEndsAt?matchEndsAt-Date.now():Infinity));const seconds=Math.ceil(remain/1000);const mm=String(Math.floor(seconds/60)).padStart(2,"0");const ss=String(seconds%60).padStart(2,"0");
    ui.competitionTimer.textContent=`${mm}:${ss}`;ui.mobileCompetitionTimer.textContent=`${mm}:${ss}`;
  }

  function updateRanking(){}
  function renderLeaderboard(){}

function boardProfile() {
  const heights = Array(COLS).fill(0);
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let seen = false;
    for (let y = 0; y < ROWS; y++) {
      if (board[y][x]) {
        if (!seen) heights[x] = ROWS - y;
        seen = true;
      } else if (seen) {
        holes++;
      }
    }
  }
  let bumpiness = 0;
  for (let x = 0; x < COLS - 1; x++) bumpiness += Math.abs(heights[x] - heights[x + 1]);
  let maxHeight = Math.max(...heights);
  let minHeight = Math.min(...heights);
  let rightWell = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (!board[y][COLS - 1]) rightWell++;
    else break;
  }
  let tSlots = 0;
  for (let y = 2; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (board[y][x]) continue;
      const left = !!board[y][x - 1], right = !!board[y][x + 1], bottom = !!board[y + 1][x];
      const roof = !!board[y - 1][x];
      if (left && right && bottom && !roof) tSlots++;
    }
  }
  return { heights, holes, bumpiness, maxHeight, minHeight, rightWell, tSlots };
}


function updateCoachAdvice() {
  if (!ui.streakText) return;
  const previousDanger=dangerLevel;
  if (state === "ready") {coachAdvice="Clear lines to build your score";dangerLevel=0;}
  else if (state === "countdown") coachAdvice="Get ready — fair seed locked";
  else if (state === "paused") coachAdvice="Paused — competition timer still runs";
  else if (state === "clearing"||state==="collapsing") coachAdvice="Clear confirmed — next piece buffered";
  else if (state === "over") coachAdvice=ranking<=3?"Prize position secured":"Review the stack and go again";
  else {
    const p=boardProfile();
    dangerLevel=p.maxHeight>=20?2:p.maxHeight>=15?1:0;
    if(dangerLevel===2)coachAdvice="Critical stack — dig immediately";
    else if(p.holes>=7)coachAdvice="Too many holes — skim and clean";
    else if(p.bumpiness>=18)coachAdvice="Uneven field — flatten the center";
    else if(p.tSlots>0&&(active?.type==="T"||queue.slice(0,3).includes("T")||holdType==="T"))coachAdvice="T-Spin shape detected";
    else if(p.rightWell>=4&&(active?.type==="I"||queue.slice(0,3).includes("I")||holdType==="I"))coachAdvice="Right well ready — bank the I-piece";
    else if(combo>=2)coachAdvice=`Combo pressure x${combo+1}`;
    else if(backToBack)coachAdvice="Back-to-back active — push a power clear";
    else if(level>=20)coachAdvice="20G active — lock decisions matter";
    else if(lines<4)coachAdvice="Open clean — prepare your first Tetris";
    else coachAdvice="Stable board — keep stacking efficiently";
  }
  if(dangerLevel>previousDanger&&state==="playing")sfx(dangerLevel===2?"dangerCritical":"danger");
  dangerSoundState=dangerLevel;
  ui.streakText.textContent=coachAdvice;
  ui.gameStage.classList.toggle("danger",dangerLevel===1);
  ui.gameStage.classList.toggle("critical",dangerLevel===2);
}

  // ---------- Visual rendering ----------

  function resizeCanvas(c, context, aspect=2) {
    const dpr=Math.min(window.devicePixelRatio||1,qualityTier===2?2:qualityTier===1?1.5:1);
    const cssW=Math.max(100,Math.round(c.clientWidth||420));
    const cssH=Math.round(cssW*aspect);
    const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    return {w:c.width,h:c.height,cell:c.width/COLS,dpr};
  }
  function resizeFxToGame() {
    if(fxCanvas.width!==canvas.width||fxCanvas.height!==canvas.height){fxCanvas.width=canvas.width;fxCanvas.height=canvas.height;}
  }

  function roundRect(g,x,y,w,h,r){r=Math.max(0,Math.min(r,Math.min(w,h)/2));g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function rgb(hex){const n=parseInt(hex.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function shade(hex,p){const {r,g,b}=rgb(hex),t=p<0?0:255,a=Math.abs(p);return `rgb(${Math.round(r+(t-r)*a)},${Math.round(g+(t-g)*a)},${Math.round(b+(t-b)*a)})`;}
  function rgba(hex,a){const {r,g,b}=rgb(hex);return `rgba(${r},${g},${b},${a})`;}
  function easeOutCubic(t){t=Math.max(0,Math.min(1,t));return 1-Math.pow(1-t,3);}
  function easeOutBack(t){t=Math.max(0,Math.min(1,t));const c1=.72,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}
  function easeInOutCubic(t){t=Math.max(0,Math.min(1,t));return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}


  function drawCell(g,px,py,size,color,alpha=1,ghost=false,hot=false,pieceType=null) {
    const pad=Math.max(1.4,size*.065),x=px+pad,y=py+pad,w=size-2*pad,r=Math.max(2,size*.065);
    g.save();g.globalAlpha=alpha;
    if(ghost){
      g.fillStyle=rgba(color,.08);g.strokeStyle=rgba(color,.85);g.lineWidth=Math.max(1,size*.035);
      g.shadowColor=color;g.shadowBlur=size*.32;roundRect(g,x,y,w,w,r);g.fill();g.stroke();g.restore();return;
    }
    g.shadowColor=color;g.shadowBlur=size*(hot?.65:.42);
    const fill=g.createLinearGradient(x,y,x+w,y+w);fill.addColorStop(0,shade(color,.22));fill.addColorStop(.32,color);fill.addColorStop(1,shade(color,-.38));
    g.fillStyle=fill;roundRect(g,x,y,w,w,r);g.fill();
    g.lineWidth=Math.max(1.4,size*.043);g.strokeStyle=shade(color,.72);g.stroke();
    g.shadowBlur=0;
    const inner=g.createLinearGradient(0,y,0,y+w);inner.addColorStop(0,'rgba(255,255,255,.55)');inner.addColorStop(.2,'rgba(255,255,255,.04)');inner.addColorStop(1,'rgba(0,0,0,.12)');g.fillStyle=inner;roundRect(g,x+2,y+2,w-4,w-4,r);g.fill();
    g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=Math.max(1,size*.025);g.beginPath();g.moveTo(x+r,y+1);g.lineTo(x+w-r,y+1);g.stroke();g.restore();
  }

  function getBlockSprite(size,type,hot=false) {
    const px=Math.max(10,Math.round(size));
    const key=`${type}:${px}:${hot?1:0}:${currentTheme.name}`;
    if(blockSpriteCache.has(key)) return blockSpriteCache.get(key);
    if(blockSpriteCache.size>72) blockSpriteCache.clear();
    const margin=Math.ceil(px*.42);
    const sprite=document.createElement("canvas");
    sprite.width=sprite.height=px+margin*2;
    const g=sprite.getContext("2d");
    drawCell(g,margin,margin,px,COLORS[type],1,false,hot,type);
    const item={canvas:sprite,margin,px};
    blockSpriteCache.set(key,item);
    return item;
  }

  function drawCachedBlock(g,px,py,size,type,alpha=1,hot=false) {
    const sprite=getBlockSprite(size,type,hot);
    const scale=size/sprite.px;
    const margin=sprite.margin*scale;
    g.save();
    g.globalAlpha=alpha;
    g.drawImage(sprite.canvas,px-margin,py-margin,size+margin*2,size+margin*2);
    g.restore();
  }

  function drawScaledCachedBlock(g,px,py,baseSize,type,scale=1,alpha=1,hot=false){
    const sprite=getBlockSprite(baseSize,type,hot);
    const margin=sprite.margin*(baseSize/sprite.px);
    const full=baseSize+margin*2;
    const dest=full*scale;
    const cx=px+baseSize/2,cy=py+baseSize/2;
    g.save();g.globalAlpha=alpha;g.drawImage(sprite.canvas,cx-dest/2,cy-dest/2,dest,dest);g.restore();
  }

function drawBackground(m) {
  const {w,h,cell}=m,t=document.body.classList.contains('reduced-motion')?0:boardShaderTime;
  ctx.clearRect(0,0,w,h);
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#031745');bg.addColorStop(.48,'#010a27');bg.addColorStop(1,'#041333');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(let i=0;i<5;i++){
    const x=w*(.2+.6*(.5+.5*Math.sin(i*2.7+t*.15))),y=h*(.12+i*.2);
    const nebula=ctx.createRadialGradient(x,y,0,x,y,w*.62);nebula.addColorStop(0,i%2?'rgba(64,26,187,.10)':'rgba(0,110,234,.15)');nebula.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=nebula;ctx.fillRect(0,0,w,h);
  }
  ctx.save();
  for(let i=0;i<90;i++){
    const x=((Math.sin(i*42.137)*43758.5)%1+1)%1*w,y=((Math.sin(i*93.72+11)*23612.7)%1+1)%1*h;
    const bright=.25+.35*(.5+.5*Math.sin(t*(.7+i%3)+i));ctx.globalAlpha=bright;ctx.fillStyle=i%4?'#167fff':'#60eaff';
    const r=i%13===0?2.1:1;ctx.fillRect(x,y,r*m.dpr,r*m.dpr);
    if(i%13===0&&qualityTier>0){ctx.globalAlpha=bright*.28;ctx.fillRect(x-4*m.dpr,y,9*m.dpr,m.dpr);ctx.fillRect(x,y-4*m.dpr,m.dpr,9*m.dpr);}
  }
  ctx.restore();
  // Bright, legible full-width grid — ten columns by twenty rows.
  ctx.lineWidth=Math.max(.65,m.dpr*.55);
  for(let x=0;x<=COLS;x++){ctx.strokeStyle=x%5===0?'rgba(29,166,255,.58)':'rgba(25,132,225,.34)';ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,h);ctx.stroke();}
  for(let y=0;y<=VISIBLE_ROWS;y++){ctx.strokeStyle=y%5===0?'rgba(50,152,248,.55)':'rgba(25,122,218,.32)';ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(w,y*cell);ctx.stroke();}
  const sweepY=(t*28)%(h+100)-100,scan=ctx.createLinearGradient(0,sweepY,0,sweepY+100);scan.addColorStop(0,'rgba(0,100,255,0)');scan.addColorStop(.8,'rgba(0,130,255,.045)');scan.addColorStop(1,'rgba(0,150,255,0)');ctx.fillStyle=scan;ctx.fillRect(0,sweepY,w,100);
  if(boardPulse>0||flashPulse>0){ctx.fillStyle=`rgba(84,209,255,${boardPulse*.10+flashPulse*.18})`;ctx.fillRect(0,0,w,h);}
  if(dangerLevel>0){const warn=ctx.createLinearGradient(0,0,0,h*.6);warn.addColorStop(0,`rgba(255,25,103,${(.08+.035*Math.sin(t*8))*dangerLevel})`);warn.addColorStop(1,'transparent');ctx.fillStyle=warn;ctx.fillRect(0,0,w,h*.6);}
}

function updateVisualPose(dt){
  if(!active)return;
  if(visualPose.type!==active.type){
    visualPose.type=active.type;visualPose.x=active.x;visualPose.y=active.y;visualPose.rotationOffset=0;visualPose.scaleY=1;
  }
  const sx=1-Math.exp(-32*dt),sy=1-Math.exp(-24*dt),sr=1-Math.exp(-28*dt);
  visualPose.x+=(active.x-visualPose.x)*sx;
  if(level>=22)visualPose.y=active.y;else visualPose.y+=(active.y-visualPose.y)*sy;
  visualPose.rotationOffset+=(0-visualPose.rotationOffset)*sr;
  const lockPressure=grounded?Math.min(1,lockAccumulator/LOCK_DELAY_MS):0;
  const targetScale=1-lockPressure*.035;
  visualPose.scaleY+=(targetScale-visualPose.scaleY)*(1-Math.exp(-18*dt));
}

function drawVisualActive(piece,cell){
  const n=piece.matrix.length;
  const cx=visualPose.x+n/2,cy=visualPose.y+n/2;
  const a=visualPose.rotationOffset,ca=Math.cos(a),sa=Math.sin(a);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(!piece.matrix[y][x])continue;
    const lx=x+.5-n/2,ly=(y+.5-n/2)*visualPose.scaleY;
    const rx=lx*ca-ly*sa,ry=lx*sa+ly*ca;
    const bx=cx+rx-.5,by=cy+ry-.5-HIDDEN_ROWS;
    if(by<-1)continue;
    if(!document.body.classList.contains('reduced-motion')){
      const tail=cell*(4.0+.35*Math.sin(boardShaderTime*3+x)),bottom=by*cell+cell*.3;
      const beam=ctx.createLinearGradient(0,bottom-tail,0,bottom);beam.addColorStop(0,rgba(COLORS[piece.type],0));beam.addColorStop(1,rgba(COLORS[piece.type],.42));ctx.fillStyle=beam;ctx.fillRect(bx*cell+cell*.14,bottom-tail,cell*.72,tail);
    }
    drawCachedBlock(ctx,bx*cell,by*cell,cell,piece.type,1,grounded);
  }
}


function renderGame() {
  const m=resizeCanvas(canvas,ctx,2);resizeFxToGame();drawBackground(m);
  const {cell}=m;
  const collapseProgress=collapseState?easeOutBack(collapseState.elapsedMs/collapseState.duration):1;

  for(let y=HIDDEN_ROWS;y<ROWS;y++) for(let x=0;x<COLS;x++){
    const type=board[y][x];if(!type)continue;
    let renderY=y-HIDDEN_ROWS;
    let alpha=1,scale=1,hot=false;

    if(clearState && clearState.rows.includes(y)){
      const progress=clearState.elapsedMs/clearState.duration;
      const dist=Math.abs(x-(COLS-1)/2)/((COLS-1)/2);
      const delayed=Math.max(0,Math.min(1,(progress-dist*.20)/.80));
      const eased=easeInOutCubic(delayed);
      alpha=1-eased;
      scale=Math.max(.02,1-eased*.88);
      hot=true;
      if(alpha<=.01)continue;
    }

    if(collapseState){
      const fall=collapseState.offsets[y]||0;
      renderY-=fall*(1-collapseProgress);
    }

    if(scale!==1)drawScaledCachedBlock(ctx,x*cell,renderY*cell,cell,type,scale,alpha,hot);
    else drawCachedBlock(ctx,x*cell,renderY*cell,cell,type,alpha,hot);
  }

  if(active && state!=="over"){
    if(qualityTier>0){
      const ax=(visualPose.x+active.matrix.length/2)*cell,ay=(visualPose.y-HIDDEN_ROWS+active.matrix.length/2)*cell;
      ctx.save();ctx.globalCompositeOperation="screen";
      const cast=ctx.createRadialGradient(ax,ay,0,ax,ay,cell*3.2);cast.addColorStop(0,rgba(COLORS[active.type],.10));cast.addColorStop(.55,rgba(COLORS[active.type],.025));cast.addColorStop(1,rgba(COLORS[active.type],0));ctx.fillStyle=cast;ctx.fillRect(0,0,m.w,m.h);ctx.restore();
    }
    const gy=ghostY();drawPiece(active,gy,cell,.45,true);drawVisualActive(active,cell);
  }
  renderFx(m);
}

function drawPiece(piece,yPos,cell,alpha,ghost){
  for(let y=0;y<piece.matrix.length;y++)for(let x=0;x<piece.matrix[y].length;x++){
    if(!piece.matrix[y][x])continue;
    const vy=yPos+y-HIDDEN_ROWS;if(vy<0)continue;
    if(ghost)drawCell(ctx,(piece.x+x)*cell,vy*cell,cell,COLORS[piece.type],alpha,true,false,piece.type);
    else drawCachedBlock(ctx,(piece.x+x)*cell,vy*cell,cell,piece.type,alpha,false);
  }
}


function renderFx(m){
  const {w,h,cell}=m;fx.clearRect(0,0,w,h);
  for(const t of trails){fx.save();fx.globalAlpha=Math.max(0,t.life/t.max);fx.strokeStyle=t.color;fx.shadowColor=t.color;fx.shadowBlur=cell*(qualityTier===2?.38:.22);fx.lineWidth=Math.max(2,cell*.075);fx.beginPath();fx.moveTo(t.x1*cell,t.y1*cell);fx.lineTo(t.x2*cell,t.y2*cell);fx.stroke();fx.restore();}
  if(comboHeat>0){fx.save();fx.globalCompositeOperation="screen";const aura=fx.createRadialGradient(w*.5,h*.64,0,w*.5,h*.64,Math.max(cell*2.5, h*.28));aura.addColorStop(0,`rgba(255,114,245,${comboHeat*.16})`);aura.addColorStop(.38,`rgba(255,207,82,${comboHeat*.10})`);aura.addColorStop(1,"rgba(0,0,0,0)");fx.fillStyle=aura;fx.fillRect(0,0,w,h);fx.restore();}
  for(const f of lineFlashes){const vy=f.y-HIDDEN_ROWS;if(vy<0||vy>=VISIBLE_ROWS)continue;fx.save();fx.globalCompositeOperation="screen";fx.globalAlpha=Math.max(0,f.life/f.max);const grad=fx.createLinearGradient(0,0,w,0);grad.addColorStop(0,"rgba(255,255,255,0)");grad.addColorStop(.16,"rgba(81,236,255,.54)");grad.addColorStop(.5,"rgba(255,255,255,1)");grad.addColorStop(.84,"rgba(81,236,255,.54)");grad.addColorStop(1,"rgba(255,255,255,0)");fx.fillStyle=grad;fx.fillRect(0,vy*cell,w,cell);fx.restore();}
  for(const sw of shockwaves){fx.save();fx.globalAlpha=Math.max(0,sw.life/sw.max)*.72;fx.strokeStyle=sw.color;fx.shadowColor=sw.color;fx.shadowBlur=cell*.35;fx.lineWidth=Math.max(1.5,cell*.045);fx.beginPath();fx.ellipse(sw.x*cell,sw.y*cell,sw.r*cell,sw.r*cell*.38,0,0,Math.PI*2);fx.stroke();fx.restore();}
  for(const a of energyArcs){fx.save();fx.globalAlpha=Math.max(0,a.life/a.max)*.8;fx.strokeStyle=a.color;fx.shadowColor=a.color;fx.shadowBlur=cell*.25;fx.lineWidth=Math.max(1,cell*.025);fx.beginPath();fx.moveTo(a.x1*cell,a.y1*cell);const mx=(a.x1+a.x2)/2+(Math.random()-.5)*.18,my=(a.y1+a.y2)/2+(Math.random()-.5)*.18;fx.lineTo(mx*cell,my*cell);fx.lineTo(a.x2*cell,a.y2*cell);fx.stroke();fx.restore();}
  for(const p of particles){fx.save();fx.globalAlpha=Math.max(0,p.life/p.max);fx.fillStyle=p.color;fx.shadowColor=p.color;fx.shadowBlur=cell*(qualityTier===2?.26:.14);const s=p.size*cell;fx.translate(p.x*cell,p.y*cell);fx.rotate(p.rot);roundRect(fx,-s/2,-s/2,s,s,Math.max(1,s*.25));fx.fill();fx.restore();}
  for(const s of sparks){fx.save();fx.globalAlpha=Math.max(0,s.life/s.max);fx.strokeStyle=s.color;fx.shadowColor=s.color;fx.shadowBlur=cell*.18;fx.lineWidth=Math.max(1,cell*.035);fx.beginPath();fx.moveTo(s.x*cell,s.y*cell);fx.lineTo((s.x-s.vx*.035)*cell,(s.y-s.vy*.035)*cell);fx.stroke();fx.restore();}
  if(qualityTier>0)for(const d of ambientDust){fx.save();fx.globalAlpha=d.alpha*(qualityTier===2?1:.55);fx.fillStyle="#8eefff";fx.shadowColor="#5eefff";fx.shadowBlur=qualityTier===2?6*m.dpr:2*m.dpr;fx.fillRect(d.x*w,d.y*h,Math.max(1,d.size*m.dpr),Math.max(1,d.size*m.dpr));fx.restore();}
}


  function miniMetrics(c){const dpr=Math.min(window.devicePixelRatio||1,qualityTier===2?2:qualityTier===1?1.5:1),w=Math.round((c.clientWidth||220)*dpr),h=Math.round((c.clientHeight||120)*dpr);c.width=w;c.height=h;return{w,h,dpr};}
  function miniBg(g,w,h){g.clearRect(0,0,w,h);const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,"rgba(8,26,43,.88)");gr.addColorStop(.55,"rgba(3,12,24,.54)");gr.addColorStop(1,"rgba(1,8,15,.20)");g.fillStyle=gr;roundRect(g,1,1,w-2,h-2,12);g.fill();g.strokeStyle="rgba(101,235,255,.13)";g.lineWidth=1;roundRect(g,1.5,1.5,w-3,h-3,12);g.stroke();g.save();g.globalAlpha=.12;for(let i=0;i<3;i++){g.fillStyle=i===1?"rgba(92,240,255,.28)":"rgba(92,240,255,.12)";g.fillRect(w*.12,h*(.18+i*.22),w*.76,1);}g.restore();}
  function drawMini(g,type,ax,ay,aw,ah,scale=.9){if(!type)return;const m=SHAPES[type],cells=[];for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x])cells.push({x,y});const minX=Math.min(...cells.map(c=>c.x)),maxX=Math.max(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y)),maxY=Math.max(...cells.map(c=>c.y)),pw=maxX-minX+1,ph=maxY-minY+1,cs=Math.min(aw/(pw+.8),ah/(ph+.8))*scale,sx=ax+(aw-pw*cs)/2-minX*cs,sy=ay+(ah-ph*cs)/2-minY*cs;for(const c of cells)drawCell(g,sx+c.x*cs,sy+c.y*cs,cs,COLORS[type],1,false,false,type);}
  function renderSideCanvases(){
    let m=miniMetrics(holdCanvas);miniBg(holdCtx,m.w,m.h);
    if(holdType)drawMini(holdCtx,holdType,0,0,m.w,m.h,.88);else{holdCtx.fillStyle="rgba(94,162,255,.8)";holdCtx.font=`700 ${Math.max(10,Math.min(m.h*.16,m.w*.11))}px "Volt Sans", sans-serif`;holdCtx.textAlign="center";holdCtx.fillText("EMPTY",m.w/2,m.h/2+4);}
    if(holdLocked&&holdType){holdCtx.fillStyle="rgba(1,7,13,.38)";holdCtx.fillRect(0,0,m.w,m.h);holdCtx.fillStyle="rgba(181,242,250,.72)";holdCtx.font=`800 ${Math.max(9,m.h*.085)}px "Volt Sans", sans-serif`;holdCtx.textAlign="center";holdCtx.fillText("HOLD USED",m.w/2,m.h*.87);}
    const holdTouchButton=document.querySelector('.touch-controls [data-action="hold"]');if(holdTouchButton){holdTouchButton.classList.toggle("disabled-touch",holdLocked);holdTouchButton.setAttribute("aria-disabled",holdLocked?"true":"false");}
    m=miniMetrics(nextCanvas);miniBg(nextCtx,m.w,m.h);const count=Math.min(5,queue.length),ih=m.h/count;for(let i=0;i<count;i++){if(i){nextCtx.strokeStyle="rgba(20,152,255,.40)";nextCtx.beginPath();nextCtx.moveTo(m.w*.12,i*ih);nextCtx.lineTo(m.w*.88,i*ih);nextCtx.stroke();}drawMini(nextCtx,queue[i],0,i*ih,m.w,ih,.95);}
  }


function qualityMultiplier(){if(document.body.classList.contains("reduced-motion"))return 0;return qualityTier===2?1:qualityTier===1?.62:.34;}

function addMotionTrail(dx){
  if(!active||qualityTier===0)return;
  const y=active.y-HIDDEN_ROWS+active.matrix.length/2,x=active.x+active.matrix.length/2;
  trails.push({x1:x-dx*.55,y1:y,x2:x+dx*.2,y2:y,color:COLORS[active.type],life:.11,max:.11});
}

function addDropTrail(fromY,toY){
  if(!active)return;
  for(let x=0;x<active.matrix.length;x++){
    if(!active.matrix.some(r=>r[x]))continue;
    const px=active.x+x+.5;
    trails.push({x1:px,y1:fromY-HIDDEN_ROWS,x2:px,y2:toY-HIDDEN_ROWS+active.matrix.length,color:COLORS[active.type],life:.19,max:.19});
  }
}

function addImpactRipple(x,y,color,strength=1){
  shockwaves.push({x,y,r:.2,life:.42,max:.42,color,strength:Math.min(2.2,.7+strength*.08)});
  if(qualityTier>0){
    for(let i=0;i<Math.round(8*qualityMultiplier());i++)energyArcs.push({x1:x+(Math.random()-.5)*1.4,y1:y,x2:x+(Math.random()-.5)*3,y2:y-(.2+Math.random()*1.1),life:.16+Math.random()*.12,max:.28,color});
  }
}

function addLockBurst(cells,hard){
  const mult=qualityMultiplier();
  for(const c of cells){
    for(let i=0;i<Math.max(1,Math.round((hard?5:2)*mult));i++)sparks.push({x:c.x+.5,y:c.y-HIDDEN_ROWS+.5,vx:(Math.random()-.5)*7.5,vy:(Math.random()-.8)*6.5,life:.22+Math.random()*.12,max:.34,color:COLORS[c.type]});
  }
  boardPulse=Math.max(boardPulse,hard?.62:.28);
  if(cells.length){const cx=cells.reduce((a,c)=>a+c.x+.5,0)/cells.length,cy=cells.reduce((a,c)=>a+c.y-HIDDEN_ROWS+.5,0)/cells.length;shockwaves.push({x:cx,y:cy,r:.12,life:hard?.42:.24,max:hard?.42:.24,color:COLORS[cells[0].type],strength:hard?1.35:.55});}
  if(hard)stageShake();
}

function animateLineClear(rows,type){
  lineFlashes.push(...rows.map(y=>({y,life:.36,max:.36})));
  const grade=Math.max(1,Math.min(4,rows.length));
  ui.gameStage.classList.remove("clear-grade-1","clear-grade-2","clear-grade-3","clear-grade-4");
  ui.gameStage.classList.add(`clear-grade-${grade}`);
  setTimeout(()=>ui.gameStage.classList.remove(`clear-grade-${grade}`),520);
  const mult=qualityMultiplier();
  for(const y of rows){
    shockwaves.push({x:COLS/2,y:y-HIDDEN_ROWS+.5,r:.25,life:.5,max:.5,color:COLORS[type],strength:1+rows.length*.18});
    for(let i=0;i<Math.max(14,Math.round((30+rows.length*14)*mult));i++)particles.push({x:Math.random()*COLS,y:y-HIDDEN_ROWS+.5,vx:(Math.random()-.5)*(6+rows.length),vy:(Math.random()-.62)*5.5,rot:Math.random()*Math.PI,size:.035+Math.random()*.095,life:.65+Math.random()*.36,max:1.01,color:i%4===0?"#ffffff":COLORS[type]});
    if(qualityTier>0)for(let i=0;i<Math.round(6*mult);i++)energyArcs.push({x1:COLS*.5,y1:y-HIDDEN_ROWS+.5,x2:Math.random()*COLS,y2:y-HIDDEN_ROWS+(Math.random()-.5)*1.5,life:.18+Math.random()*.16,max:.34,color:COLORS[type]});
  }
  boardPulse=Math.min(1.4,.72+rows.length*.18);flashPulse=Math.min(1.35,.48+rows.length*.18);stageShake();
  if(rows.length===4){ui.gameStage.classList.remove("tetris-burst");void ui.gameStage.offsetWidth;ui.gameStage.classList.add("tetris-burst");}
}

function triggerLevelUp(newLevel){
  ui.gameStage.classList.remove("level-up");void ui.gameStage.offsetWidth;ui.gameStage.classList.add("level-up");
  showFloating(`LEVEL ${newLevel}`,newLevel>=22?"20G MODE":"SPEED INCREASED");
  triggerCenterBlast(currentTheme.primary,newLevel>=15?1.7:1.35);
  triggerCenterBlast(currentTheme.accent,newLevel>=10?1.15:.82);
  sfx("levelUp");
}

function playClearSfx(clearCount,spin,perfectClear,b2bBonus,comboIndex){
  if(perfectClear){sfx("perfect");return;}
  if(spin.tspin){sfx(spin.mini?"tspinMini":"tspin");}
  else if(clearCount===4)sfx("tetris");
  else if(clearCount===3)sfx("triple");
  else if(clearCount===2)sfx("double");
  else if(clearCount===1)sfx("single");
  else sfx("lock");
  if(b2bBonus)sfx("b2b");
  if(clearCount>0&&comboIndex>=2)sfx("combo",Math.min(comboIndex,8));
}

function stageShake(){ui.gameStage.classList.remove("shake");void ui.gameStage.offsetWidth;ui.gameStage.classList.add("shake");}
function showFloating(main,sub=""){ui.floatingEvent.innerHTML=`${main}${sub?`<div style="font-size:10px;margin-top:5px;color:#8cf8ff;letter-spacing:.12em;text-shadow:0 0 10px rgba(93,240,255,.35)">${sub}</div>`:""}`;ui.floatingEvent.classList.remove("show");void ui.floatingEvent.offsetWidth;ui.floatingEvent.classList.add("show");}

function comboTierLabel(chain){
  if(chain>=8)return "ULTRA VOLT COMBO";
  if(chain>=6)return "HYPER COMBO";
  if(chain>=4)return "MEGA COMBO";
  if(chain>=2)return "COMBO ACTIVE";
  return "READY";
}

function updateComboHud(){
  if(!ui.comboBanner) return;
  const chain = combo>0 ? combo+1 : 0;
  const fill = Math.max(0, Math.min(1, chain/8));
  if(ui.comboMeterFill) ui.comboMeterFill.style.width = `${(fill*100).toFixed(1)}%`;
  if(ui.comboChain) ui.comboChain.textContent = chain ? `x${chain}` : "READY";
  if(ui.comboSub) ui.comboSub.textContent = chain
    ? `${comboTierLabel(chain)} • Run x${Math.max(maxCombo,chain)} • Best x${bestComboEver} • Registered ${comboChainsRegistered}`
    : `Chain consecutive clears • Run x${maxCombo || 0} • Best x${bestComboEver} • Registered ${comboChainsRegistered}`;
  ui.comboBanner.classList.toggle("hot", chain>=2 || comboHeat>.42);
}

function triggerComboCelebration(chain,pieceType,clearCount){
  const accent = chain>=6 ? "#caff75" : chain>=4 ? "#ffbf53" : "#ff74fb";
  const centerY = Math.max(4, VISIBLE_ROWS - 6 - clearCount*.7);
  const mult = qualityMultiplier();
  shockwaves.push({x:COLS/2,y:centerY,r:.18,life:.44,max:.44,color:accent,strength:1.25+chain*.08});
  shockwaves.push({x:COLS/2,y:centerY,r:.12,life:.34,max:.34,color:COLORS[pieceType],strength:1.05});
  for(let i=0;i<Math.max(12,Math.round((18+chain*3)*mult));i++){
    particles.push({x:COLS/2+(Math.random()-.5)*3.8,y:centerY+(Math.random()-.5)*1.1,vx:(Math.random()-.5)*(5.5+chain*.5),vy:-1.2-Math.random()*(2.6+chain*.18),rot:Math.random()*Math.PI,size:.04+Math.random()*.08,life:.55+Math.random()*.28,max:.9,color:i%3===0?accent:(i%4===0?"#ffffff":COLORS[pieceType])});
  }
  for(let i=0;i<Math.max(4,Math.round((5+chain)*mult));i++) energyArcs.push({x1:COLS/2+(Math.random()-.5)*1.4,y1:centerY,x2:Math.random()*COLS,y2:centerY-(1+Math.random()*4.2),life:.18+Math.random()*.14,max:.3,color:i%2?accent:COLORS[pieceType]});
  boardPulse=Math.max(boardPulse,.42+.04*chain);
  flashPulse=Math.max(flashPulse,.18+.025*chain);
  if(ui.comboBanner){
    ui.comboBanner.classList.remove("burst");
    void ui.comboBanner.offsetWidth;
    ui.comboBanner.classList.add("burst");
  }
  if(chain>=4) showFloating(`COMBO x${chain}`, `${comboTierLabel(chain)} • REGISTERED`);
  emitGameEvent("combo_registered",{chain,maxCombo,registered:comboChainsRegistered,level,score});
}

function triggerCenterBlast(color="#7cf6ff", strength=1){
  const mult = qualityMultiplier();
  const x = COLS/2, y = VISIBLE_ROWS*.47;
  shockwaves.push({x,y,r:.18,life:.46,max:.46,color,strength:1.1*strength});
  shockwaves.push({x,y,r:.06,life:.28,max:.28,color:"#ffffff",strength:.95*strength});
  for(let i=0;i<Math.max(10,Math.round(22*mult*strength));i++){
    particles.push({x,y,vx:(Math.random()-.5)*(8+strength*3.5),vy:(Math.random()-.5)*(6+strength*2.2),rot:Math.random()*Math.PI,size:.04+Math.random()*.075,life:.45+Math.random()*.24,max:.82,color:i%5===0?"#ffffff":color});
  }
  for(let i=0;i<Math.max(8,Math.round(14*mult*strength));i++){
    sparks.push({x,y,vx:(Math.random()-.5)*(9+strength*4),vy:(Math.random()-.5)*(8+strength*3),life:.18+Math.random()*.16,max:.32,color});
  }
  if(qualityTier>0) for(let i=0;i<Math.max(4,Math.round(10*mult*strength));i++) energyArcs.push({x1:x,y1:y,x2:x+(Math.random()-.5)*COLS*.9,y2:y+(Math.random()-.5)*VISIBLE_ROWS*.6,life:.16+Math.random()*.16,max:.3,color});
  boardPulse=Math.max(boardPulse,.35*strength);
  flashPulse=Math.max(flashPulse,.18*strength);
}

function initAmbientDust(){ambientDust=Array.from({length:28},()=>({x:Math.random(),y:Math.random(),size:.5+Math.random()*1.7,alpha:.025+Math.random()*.085,vy:.003+Math.random()*.007,vx:(Math.random()-.5)*.0018,twinkle:Math.random()*Math.PI*2}));}

function updateEffects(dt){
  boardPulse=Math.max(0,boardPulse-dt*2.7);flashPulse=Math.max(0,flashPulse-dt*5);comboHeat=Math.max(0,comboHeat-dt*.2);boardShaderTime+=dt;
  lineFlashes.forEach(f=>f.life-=dt);lineFlashes=lineFlashes.filter(f=>f.life>0);
  trails.forEach(t=>t.life-=dt);trails=trails.filter(t=>t.life>0);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=7.8*dt;p.rot+=dt*4;p.life-=dt;});particles=particles.filter(p=>p.life>0);
  sparks.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=9*dt;s.life-=dt;});sparks=sparks.filter(s=>s.life>0);
  for(let i=shockwaves.length-1;i>=0;i--){const s=shockwaves[i];s.r+=dt*(5.5*s.strength);s.life-=dt;if(s.life<=0)shockwaves.splice(i,1);}
  for(let i=energyArcs.length-1;i>=0;i--){const a=energyArcs[i];a.life-=dt;if(a.life<=0)energyArcs.splice(i,1);}
  ambientDust.forEach(d=>{d.y-=d.vy*dt*(1+dangerLevel*.75);d.x+=d.vx*dt*(1+dangerLevel*.35);d.twinkle+=dt*2;if(d.y<0){d.y=1;d.x=Math.random();}if(d.x<0)d.x=1;if(d.x>1)d.x=0;d.alpha=Math.max(.02,Math.min(.12,d.alpha+Math.sin(d.twinkle)*.0009));});
  updateCoachAdvice();
  applyLevelTheme();
}

function updatePerformanceQuality(frameMs,now){
  if(frameMs>0)fpsSamples.push(1000/frameMs);
  if(fpsSamples.length>180)fpsSamples.shift();
  if(now-lastQualityCheck<4500||fpsSamples.length<90)return;
  lastQualityCheck=now;
  const avg=fpsSamples.reduce((a,b)=>a+b,0)/fpsSamples.length;
  let next=qualityTier;
  if(avg<46&&qualityTier>0)next--;
  else if(avg>58&&qualityTier<2)next++;
  if(next!==qualityTier){
    qualityTier=next;blockSpriteCache.clear();
    ui.gameStage.classList.toggle("low-quality",qualityTier===0);
    ui.gameStage.classList.toggle("medium-quality",qualityTier===1);
    renderSideCanvases();
  }
}


// ---------- Input ----------

function setHeld(name,isDown,now=simulationTimeMs){
  const h=held[name];
  if(isDown&&!h.down){
    h.down=true;h.started=now;h.repeat=now;
    if(name==="left"||name==="right")horizontalPriority=name;
  }else if(!isDown&&h.down){
    h.down=false;
    if((name==="left"||name==="right")&&horizontalPriority===name){
      const other=name==="left"?"right":"left";
      horizontalPriority=held[other].down?other:null;
      if(horizontalPriority){held[other].started=now;held[other].repeat=now;}
    }
  }
}

function directionDown(name,shouldRecord=true){
  if(!["left","right","down"].includes(name))return;
  if(held[name].down)return;
  if(shouldRecord)recordReplayInput(name,"down");
  setHeld(name,true,simulationTimeMs);
  if(state==="playing"){
    if(name==="left")tryMove(-1,0);
    else if(name==="right")tryMove(1,0);
    else if(name==="down")tryMove(0,1,true);
  }
}

function directionUp(name,shouldRecord=true){
  if(!["left","right","down"].includes(name))return;
  if(!held[name].down)return;
  if(shouldRecord)recordReplayInput(name,"up");
  setHeld(name,false,simulationTimeMs);
}

function releaseHeldInputs(){
  pressed.clear();
  held.left.down=false;held.right.down=false;held.down.down=false;
  horizontalPriority=null;
}

// Soft drop is deliberately piece-scoped. If the current piece locks while the
// player is still holding Down, the next tetromino must NOT inherit that input.
// We keep the physical key/button state in `pressed` / gamepadPrev untouched,
// so a fresh soft drop only starts after a real release + press edge.
function disarmSoftDropCarryover(){
  held.down.down=false;
  held.down.started=simulationTimeMs;
  held.down.repeat=simulationTimeMs;
}

function processHeldInput(now){
  if(horizontalPriority){
    const h=held[horizontalPriority];
    const dx=horizontalPriority==="left"?-1:1;
    if(h.down && now-h.started>=controlConfig.dasMs){
      if(controlConfig.instantArr || controlConfig.arrMs===0){
        while(tryMove(dx,0)){}
        h.started=Number.POSITIVE_INFINITY;
      } else {
        while(now-h.repeat>=controlConfig.arrMs){
          if(!tryMove(dx,0))break;
          h.repeat+=controlConfig.arrMs;
        }
      }
    }
  }
  const d=held.down;
  if(d.down){
    while(now-d.repeat>=controlConfig.softDropMs){
      if(!tryMove(0,1,true))break;
      d.repeat+=controlConfig.softDropMs;
    }
  }
}

function bufferOrAct(actionName,shouldRecord=true){
  if(state==="clearing"||state==="collapsing"){
    if(actionName==="rotateCW")bufferedRotation=1;
    else if(actionName==="rotateCCW")bufferedRotation=-1;
    else if(actionName==="hold")bufferedHold=true;
    if(shouldRecord)recordReplayInput(actionName);
    return true;
  }
  return false;
}

function keyDown(e){
  if(document.querySelector("dialog[open]") || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable)return;
  const code=e.code;
  const prevent=["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space","KeyZ","KeyX","KeyC","KeyP","KeyR","Enter","Escape","ShiftLeft","ShiftRight"];
  if(prevent.includes(code))e.preventDefault();
  if(pressed.has(code))return;
  pressed.add(code);
  initAudio();

  if(state==="ready"&&(code==="Enter"||code==="Space")){resetGame();return;}
  if(state==="over"&&code==="Enter"){resetGame();return;}
  if(code==="KeyP"||code==="Escape"){togglePause();return;}

  if(state==="countdown"||state==="paused")return;

  if(code==="ArrowLeft")directionDown("left");
  else if(code==="ArrowRight")directionDown("right");
  else if(code==="ArrowDown")directionDown("down");
  else if(code==="ArrowUp"||code==="KeyX"||code==="KeyR"){if(!bufferOrAct("rotateCW")&&canPlay())rotate(1);}
  else if(code==="KeyZ"){if(!bufferOrAct("rotateCCW")&&canPlay())rotate(-1);}
  else if(code==="Space"){if(canPlay())hardDrop();}
  else if(code==="KeyC"||code==="ShiftLeft"||code==="ShiftRight"){if(!bufferOrAct("hold")&&canPlay())hold();}
}

function keyUp(e){
  pressed.delete(e.code);
  if(e.code==="ArrowLeft")directionUp("left");
  if(e.code==="ArrowRight")directionUp("right");
  if(e.code==="ArrowDown")directionUp("down");
}

function action(name){
  initAudio();
  if(state==="ready"&&name==="drop"){resetGame();return;}
  if(name==="left")directionDown("left");
  else if(name==="right")directionDown("right");
  else if(name==="down")directionDown("down");
  else if(name==="rotate"){if(!bufferOrAct("rotateCW")&&canPlay())rotate(1);}
  else if(name==="hold"){if(!bufferOrAct("hold")&&canPlay())hold();}
  else if(name==="drop"&&canPlay())hardDrop();
}

function bindTouchButton(btn){
  const name=btn.dataset.action;
  const isDirectional=["left","right","down"].includes(name);
  let contact=null,lastPhysicalPress=-Infinity;

  function press(id,e){
    if(e.cancelable)e.preventDefault();
    if(contact!==null)return;
    lastPhysicalPress=performance.now();
    contact=id;
    btn.classList.add("pressed-touch");
    initAudio();
    if(!["playing","clearing","collapsing"].includes(state))return;
    action(name);
  }
  function release(id){
    if(contact===null || (id!=null && contact!==id))return;
    btn.classList.remove("pressed-touch");
    if(isDirectional)directionUp(name);
    contact=null;
  }
  // Handle native touches even when the browser advertises Pointer Events.
  // Mouse and pen use Pointer Events; touch has one owner, avoiding double taps.
  btn.addEventListener("touchstart",e=>{
    const t=e.changedTouches[0];if(t)press(`touch:${t.identifier}`,e);
  },{passive:false});
  const endTouch=e=>{
    for(const t of e.changedTouches){if(contact===`touch:${t.identifier}`){if(e.cancelable)e.preventDefault();release(contact);}}
  };
  window.addEventListener("touchend",endTouch,{passive:false});
  window.addEventListener("touchcancel",endTouch,{passive:false});
  btn.addEventListener("pointerdown",e=>{
    if(e.pointerType==="touch"||e.button!==0)return;
    press(`pointer:${e.pointerId}`,e);
    try{btn.setPointerCapture(e.pointerId);}catch(_){}
  },{passive:false});
  const endPointer=e=>{if(e.pointerType!=="touch")release(`pointer:${e.pointerId}`);};
  window.addEventListener("pointerup",endPointer);
  window.addEventListener("pointercancel",endPointer);
  btn.addEventListener("lostpointercapture",endPointer);
  // Accessibility activation and webviews that deliver click-only taps.
  btn.addEventListener("click",e=>{
    e.preventDefault();
    if(contact!==null||performance.now()-lastPhysicalPress<700)return;
    action(name);
    if(isDirectional)directionUp(name);
  });
  btn.addEventListener("contextmenu",e=>e.preventDefault());
  window.addEventListener("blur",()=>release());
  document.addEventListener("visibilitychange",()=>{if(document.hidden)release();});
}

function pollGamepad(){
  const pads=navigator.getGamepads?.();
  const gp=pads&&[...pads].find(Boolean);
  if(!gp){gamepadPrev=null;return;}
  const left=(gp.buttons[14]?.pressed)||((gp.axes[0]||0)<-.55);
  const right=(gp.buttons[15]?.pressed)||((gp.axes[0]||0)>.55);
  const down=(gp.buttons[13]?.pressed)||((gp.axes[1]||0)>.62);
  const now={left,right,down,a:!!gp.buttons[0]?.pressed,x:!!gp.buttons[2]?.pressed,y:!!gp.buttons[3]?.pressed,lb:!!gp.buttons[4]?.pressed,start:!!gp.buttons[9]?.pressed};
  const prev=gamepadPrev||{};
  for(const dir of ["left","right","down"]){
    if(now[dir]&&!prev[dir])directionDown(dir);
    if(!now[dir]&&prev[dir])directionUp(dir);
  }
  if(now.a&&!prev.a){if(!bufferOrAct("rotateCW")&&canPlay())rotate(1);}
  if(now.x&&!prev.x){if(!bufferOrAct("rotateCCW")&&canPlay())rotate(-1);}
  if(now.y&&!prev.y&&canPlay())hardDrop();
  if(now.lb&&!prev.lb){if(!bufferOrAct("hold")&&canPlay())hold();}
  if(now.start&&!prev.start)togglePause();
  gamepadPrev=now;
}


// ---------- Audio / adaptive music ----------

function initAudio(){window.VoltAudio?.unlock();}
function sfx(name,value=0){if(soundEnabled)window.VoltAudio?.play(name,value);}
function updateAdaptiveMusic(){window.VoltAudio?.update({state,hidden:document.hidden});}

  // ---------- Competition telemetry / integrity hooks ----------

  async function sha256(text){if(!crypto.subtle)return `weak-${simpleHash(text)}`;const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
  function simpleHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}

  function validateTelemetry(type,payload){
    if(score<telemetry.lastScore){telemetry.impossibleFlags++;return false;}
    if(score-telemetry.lastScore>100000){telemetry.impossibleFlags++;return false;}
    if(telemetry.inputCount>50000){telemetry.impossibleFlags++;return false;}
    telemetry.lastScore=score;
    return true;
  }

  function emitGameEvent(type,payload={}){
    const task=async()=>{
      telemetry.sequence++;
      const valid=validateTelemetry(type,payload);
      const event={
        channel:"chartvolt-game",
        game:"neon-stack",
        version:"9.6",
        competitionId:document.getElementById("competitionId")?.textContent||"CV-TTR-2048",
        roomId,
        sessionId:telemetry.sessionId,
        seq:telemetry.sequence,
        type,
        ts:Date.now(),
        elapsedMs:Date.now()-telemetry.startTime,
        score,lines,level,rank:ranking,
        integrityValid:valid,
        ...payload
      };
      telemetry.chain=await sha256(`${telemetry.chain}|${JSON.stringify(event)}`);
      event.integrityChain=telemetry.chain;
      ui.integrityStatus.textContent=telemetry.impossibleFlags?"Telemetry warning":(window.ChartvoltCompetition?.isCompetition()?"Host connected · verification pending":"Practice · local score");if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent=ui.integrityStatus.textContent;
      ui.integrityDot.style.color=telemetry.impossibleFlags?"#ff8ea8":"";if(ui.integrityDotMobile)ui.integrityDotMobile.style.color=telemetry.impossibleFlags?"#ff8ea8":"";
      window.dispatchEvent(new CustomEvent("chartvolt:tetris",{detail:event}));

      if(typeof window.ChartvoltGameBridge?.onEvent==="function"){try{window.ChartvoltGameBridge.onEvent(event)}catch(_){}}
      // Optional production adapter. Your host can inject a signed session token and collector.
      if(typeof window.ChartvoltCompetition?.reportEvent==="function"){
        try{await window.ChartvoltCompetition.reportEvent(event,telemetry.serverToken)}catch(_){ui.integrityStatus.textContent="Sync pending";if(ui.integrityStatusMobile)ui.integrityStatusMobile.textContent="Sync pending";}
      }
      return event;
    };
    telemetry.pending=telemetry.pending.then(task,task);
    return telemetry.pending;
  }


// ---------- Main loop / deterministic simulation ----------

function updateCompetitionClock(){
  if(matchEndsAt && Date.now()>=matchEndsAt && !['ready','over'].includes(state)){
    finishGame('TIME UP','CONTEST ENDED');return false;
  }
  if(replay.playing){
    elapsedCompetition=Math.min(competitionDurationMs,Math.max(0,(gameStep-levelTimerStartStep)*FIXED_STEP_MS));
  } else if(competitionEndsAt){
    elapsedCompetition=Math.min(competitionDurationMs,Math.max(0,competitionDurationMs-(competitionEndsAt-performance.now())));
  }
  const remaining=Math.max(0,competitionDurationMs-elapsedCompetition);
  if(!finalTenTriggered && state!=="countdown" && state!=="ready" && remaining<=10000 && remaining>0){
    finalTenTriggered=true;
    ui.gameStage.classList.add("time-critical");
    showFloating("10 SECONDS","FINAL PUSH");
    sfx("warning");
  }
  if(remaining<=0 && state!=="over" && state!=="ready" && state!=="countdown"){
    elapsedCompetition=competitionDurationMs;
    finishGame("TIME UP","COMPETITION COMPLETE");
    return false;
  }
  return true;
}


function fixedUpdate(dtMs){
  if(state==="countdown"){
    if(!updateCompetitionClock())return;
    simulationTimeMs+=dtMs;
    countdownState.remainingMs-=dtMs;
    const n=Math.max(1,Math.ceil(countdownState.remainingMs/1000));
    if(n!==countdownState.lastNumber && countdownState.remainingMs>0){
      countdownState.lastNumber=n;
      showCountdownNumber(n);
      sfx("countdown");
    }
    if(countdownState.remainingMs<=0)beginPlay();
    return;
  }

  if(["playing","clearing","collapsing","paused"].includes(state)){
    if(!updateCompetitionClock())return;
  }

  if(state==="paused"||state==="ready"||state==="over")return;

  gameStep++;
  applyReplayEventsForStep();
  simulationTimeMs+=dtMs;

  if(state==="clearing"){
    if(clearState){clearState.elapsedMs+=dtMs;if(clearState.elapsedMs>=clearState.duration)finishClearAnimation();}
    return;
  }

  if(state==="collapsing"){
    if(collapseState){collapseState.elapsedMs+=dtMs;if(collapseState.elapsedMs>=collapseState.duration)finishCollapseAnimation();}
    return;
  }

  if(state!=="playing"||!active)return;

  trackGroundContact();
  processHeldInput(simulationTimeMs);

  const rps=gravityRowsPerSecond();
  if(!Number.isFinite(rps)){
    const gy=ghostY();
    if(gy>active.y){active.y=gy;}
  } else {
    gravityAccumulator+=rps*(dtMs/1000);
    let safety=0;
    while(gravityAccumulator>=1 && safety++<40){
      if(!collides(active.matrix,active.x,active.y+1)){
        active.y++;
        trackGroundContact();
        gravityAccumulator-=1;
      }else{
        gravityAccumulator=0;
        break;
      }
    }
  }

  trackGroundContact();
  if(lockStarted){
    lockAccumulator+=dtMs;
    if(lockAccumulator+1e-7>=LOCK_DELAY_MS){
      // Settle after an upward kick/ledge escape, without hard-drop points.
      const landingY=ghostY();
      if(landingY!==active.y){active.y=landingY;lastMoveWasRotation=false;lastKickIndex=0;}
      lockPiece(false);
    }
  }

  if(replay.playing && replay.finalStep && gameStep>replay.finalStep+120 && state!=="over"){
    finishGame("REPLAY COMPLETE","DETERMINISTIC PLAYBACK");
  }
}

function tick(now){
  const frameMs=Math.min(100,Math.max(0,now-lastFrame));
  renderDeltaSec=Math.max(.001,frameMs/1000);
  lastFrame=now;
  simulationAccumulator+=frameMs;
  if(!replay.playing)pollGamepad();

  let steps=0;
  while(simulationAccumulator>=FIXED_STEP_MS && steps++<8){
    fixedUpdate(FIXED_STEP_MS);
    simulationAccumulator-=FIXED_STEP_MS;
  }
  if(steps>=8)simulationAccumulator=0;

  if((state==="playing"||state==="paused"||state==="clearing"||state==="collapsing") && Date.now()-leaderboardPollAt>1500)refreshLiveStandings();
  updateVisualPose(renderDeltaSec);
  updateAnimatedScore(renderDeltaSec);
  updateEffects(renderDeltaSec);
  updateAdaptiveMusic();
  updatePerformanceQuality(frameMs,now);
  syncUi();
  renderGame();
  requestAnimationFrame(tick);
}


function runEngineSelfTest(){
  function sequenceForSeed(seed,count=14){
    let h=2166136261>>>0;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}let st=h||0x6d2b79f5;
    const rnd=()=>{let x=st>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;st=x>>>0;return(st>>>0)/4294967296;};
    const out=[];let b=[];while(out.length<count){if(!b.length){b=Object.keys(SHAPES);for(let i=b.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[b[i],b[j]]=[b[j],b[i]];}}out.push(b.pop());}return out;
  }
  const a=sequenceForSeed("chartvolt-self-test"),b=sequenceForSeed("chartvolt-self-test");
  const checks={
    softDropScoreNeutral:SOFT_DROP_POINTS_PER_CELL===0,
    perLevelTimerEnabled:true,
    softDropDoesNotCarryAcrossPieces:typeof disarmSoftDropCarryover==="function",
    hardDropScoring:HARD_DROP_POINTS_PER_CELL===2,
    single:SCORE.single===100,
    doublePremium:SCORE.double>SCORE.single*2,
    triplePremium:SCORE.triple>SCORE.single*3,
    tetrisPremium:SCORE.tetris>SCORE.single*4,
    tSpinDoublePremium:SCORE.tspin2>SCORE.tetris,
    deterministicBag:JSON.stringify(a)===JSON.stringify(b),
    sevenBagUnique:new Set(a.slice(0,7)).size===7,
    fixedStep60Hz:Math.abs(FIXED_STEP_MS-(1000/60))<.0001,
    srsJlstz:Object.keys(JLSTZ_KICKS).length===8,
    srsI:Object.keys(I_KICKS).length===8,
    firstContactLockBudget:LOCK_DELAY_MS===500,
    highSpeed20G:level<22||!Number.isFinite(gravityRowsPerSecond())
  };
  return {ok:Object.values(checks).every(Boolean),checks,preview:a};
}

  // ---------- Public bridge ----------


window.ChartvoltTetris={
  start:resetGame,
  end:()=>finishGame("RUN ENDED","LEFT ARENA"),
  restart:resetGame,
  pause:()=>togglePause(true),
  resume:()=>togglePause(false),
  getState:competitionSnapshot,
  exportReplay,
  async playReplay(data){
    if(!data||!Array.isArray(data.inputs))throw new Error("Invalid replay data");
    return resetGame({replayData:data});
  },
  setControls({dasMs,arrMs,softDropMs,instantArr}={}){
    if(Number.isFinite(dasMs))controlConfig.dasMs=Math.max(0,Math.min(500,Number(dasMs)));
    if(Number.isFinite(arrMs))controlConfig.arrMs=Math.max(0,Math.min(250,Number(arrMs)));
    if(Number.isFinite(softDropMs))controlConfig.softDropMs=Math.max(12,Math.min(250,Number(softDropMs)));
    if(typeof instantArr==="boolean")controlConfig.instantArr=instantArr;
    return {...controlConfig};
  },
  setQuality(mode="auto"){
    if(mode==="auto"){autoQuality=true;return {mode:"auto",tier:qualityTier};}
    autoQuality=false;
    qualityTier=mode==="low"?0:mode==="medium"?1:2;
    blockSpriteCache.clear();
    ui.gameStage.classList.toggle("low-quality",qualityTier===0);
    ui.gameStage.classList.toggle("medium-quality",qualityTier===1);
    renderSideCanvases();
    return {mode,tier:qualityTier};
  },
  setSound(enabled){
    soundEnabled=Boolean(enabled);ui.soundBtn.classList.toggle("active",soundEnabled);ui.soundBtn.setAttribute("aria-pressed",String(soundEnabled));ui.soundBtn.classList.toggle("muted",!soundEnabled);
    window.VoltAudio?.setEnabled(soundEnabled);
  },
  setMusicVolume(value){
    musicVolume=window.VoltAudio?.setMusicVolume(value)??0;
    return musicVolume;
  },
  setEffectsVolume:value=>window.VoltAudio?.setEffectsVolume(value),
  setMusicTrack:index=>window.VoltAudio?.setTrack(index),
  configureCompetition({competitionId,prizePool,durationMs,serverToken,sessionId,pieceSeed:configuredPieceSeed,roomId:configuredRoomId,playersLive}={}){
    if(!["ready","over"].includes(state))throw new Error("Configure before play");
    if(competitionId)document.getElementById("competitionId").textContent=String(competitionId);
    if(prizePool!=null){const t=Number(prizePool).toLocaleString();document.getElementById("prizePool").textContent=t;document.getElementById("mobilePrizePool").textContent=t;}
    if(serverToken)telemetry.serverToken=serverToken;
    if(sessionId)telemetry.serverSessionId=sessionId;
    if(configuredPieceSeed)setPieceSeed(configuredPieceSeed);
    if(configuredRoomId)roomId=String(configuredRoomId);
    if(playersLive)playersLiveCount=Number(playersLive)||playersLiveCount;
    syncRoomMeta();
    if(durationMs&&Number(durationMs)>0)competitionDurationMs=Number(durationMs);
    return {competitionId:document.getElementById("competitionId").textContent,prizePool:document.getElementById("prizePool").textContent,durationMs:competitionDurationMs,roomId,pieceSeed};
  },
  attachServerToken(token){telemetry.serverToken=token;},
  getIntegrity(){return{sessionId:telemetry.sessionId,sequence:telemetry.sequence,chain:telemetry.chain,flags:telemetry.impossibleFlags};},
  runSelfTest:runEngineSelfTest,
  getEngineInfo(){return{version:"9.6",fixedStepHz:60,qualityTier,autoQuality,controls:{...controlConfig},softDropScoring:0,hardDropPointsPerCell:HARD_DROP_POINTS_PER_CELL};}
};

  // ---------- Wiring ----------

  document.addEventListener("keydown",keyDown,{passive:false});document.addEventListener("keyup",keyUp);
  ui.startBtn.addEventListener("click",resetGame);ui.restartBtn.addEventListener("click",resetGame);ui.resumeBtn.addEventListener("click",()=>togglePause(false));ui.pauseBtn.addEventListener("click",()=>togglePause());
  ui.soundBtn.addEventListener("click",()=>{soundEnabled=!soundEnabled;ui.soundBtn.classList.toggle("active",soundEnabled);ui.soundBtn.setAttribute("aria-pressed",String(soundEnabled));ui.soundBtn.classList.toggle("muted",!soundEnabled);window.VoltAudio?.setEnabled(soundEnabled);if(soundEnabled)sfx("resume")});
  document.querySelectorAll(".touch-controls button[data-action]").forEach(bindTouchButton);
  holdCanvas.addEventListener("pointerdown",e=>{if(matchMedia("(pointer: coarse)").matches){e.preventDefault();initAudio();if(!bufferOrAct("hold")&&canPlay())hold();}},{passive:false});
  window.addEventListener("resize",()=>{blockSpriteCache.clear();renderSideCanvases();renderGame();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden){releaseHeldInputs();togglePause(true);}else updateCompetitionClock();});
  window.addEventListener("blur",()=>{releaseHeldInputs();if(["playing","clearing","collapsing"].includes(state))togglePause(true)});

  initAmbientDust();refillQueue();initialiseOfflineStandings();syncRoomMeta();syncUi();renderLeaderboard();renderSideCanvases();setStatus("READY");renderGame();requestAnimationFrame(tick);
})();

