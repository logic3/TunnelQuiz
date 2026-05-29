/* -------------------------------------------------------------
 * TunnelQuiz — U- & S-Bahn learning game (adapted from KiezQuiz)
 * ------------------------------------------------------------- */

const RANKS = [
  { level: 1, name: "Steig-Neuling", minXp: 0, maxXp: 249 },
  { level: 2, name: "Umsteiger", minXp: 250, maxXp: 749 },
  { level: 3, name: "Gleiskenner", minXp: 750, maxXp: 1499 },
  { level: 4, name: "Netzplan-Profi", minXp: 1500, maxXp: 2499 },
  { level: 5, name: "HVV-Experte", minXp: 2500, maxXp: Infinity }
];

function buildTrophyCatalog() {
  const specials = [
    { id: 'first_ubahn', name: 'Erste U-Bahn', icon: '🚇', desc: 'Schalte deine erste U-Bahn-Linie frei.' },
    { id: 'all_ubahn', name: 'U-Bahn-Komplett', icon: '🔵', desc: 'Meistere alle vier U-Bahn-Linien.' },
    { id: 'first_sbahn', name: 'Erste S-Bahn', icon: '🚆', desc: 'Schalte deine erste S-Bahn-Linie frei.' },
    { id: 'streak_10', name: '10er-Serie', icon: '🔥', desc: 'Erreiche eine Antwortserie von 10.' },
    { id: 'meister_alle_stationen', name: 'Netzplan-König', icon: '👑', desc: 'Benenne alle Stationen in der Sporcle-Challenge.' },
    { id: 'meister_alle_linien', name: 'Linien-Kapitän', icon: '🛤️', desc: 'Benenne alle Linien in der Challenge.' },
    { id: 'u1_speed', name: 'U1-Sprint', icon: '⚡', desc: 'Benenne alle U1-Stationen in unter 5 Minuten.' }
  ];
  const lineTrophies = (typeof LINE_PROGRESSION !== 'undefined' ? LINE_PROGRESSION : []).map(line => ({
    id: `master_${line.id.toLowerCase()}`,
    name: `${line.id}-Entdecker`,
    icon: line.id.startsWith('U') ? '🚇' : '🚆',
    desc: `Meistere alle Stationen der Linie ${line.id}.`
  }));
  return [...specials, ...lineTrophies];
}

const TROPHY_CATALOG = buildTrophyCatalog();

const MODE_LABELS = {
  EXPLORER: 'Entdecker-Modus',
  LOCATE: 'Stations-Detektiv',
  QUIZ: 'Karten-Quiz',
  TYPE_NAME: 'Namen eingeben',
  NAME_ALL: 'Nenne alle Stationen'
};

const LINES_SEGMENT_HIDDEN_MODES = [];

// Rank thresholds and titles (separate from Bezirk unlock XP)
const ROUND_TIME_LIMIT = 600; // 10 minutes for all timed game modes

// Bezirke unlock progression order (first unlocked: Altona, last: Bergedorf)
// Modes hidden in Bezirke segment (none — NAME_ALL available in both segments)
// Web Audio API Sound Synthesizer Class
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem("tq_muted") === "true";
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx?.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("tq_muted", this.muted ? "true" : "false");
    return this.muted;
  }

  playCorrect() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playCorrectTone());
  }

  _playCorrectTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // First Note
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(329.63, t); // E4
    osc1.frequency.setValueAtTime(440.00, t + 0.08); // A4
    
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    
    osc1.start(t);
    osc1.stop(t + 0.4);
  }

  playSelect() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playSelectTone());
  }

  _playSelectTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playIncorrect() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playIncorrectTone());
  }

  _playIncorrectTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.3); // Descending pitch
    
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playLevelUp() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playLevelUpTone());
  }

  playApplause() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playApplauseTone());
  }

  _playApplauseTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const claps = [
      { delay: 0, dur: 0.04, vol: 0.06 },
      { delay: 0.09, dur: 0.035, vol: 0.05 },
      { delay: 0.17, dur: 0.04, vol: 0.055 },
      { delay: 0.28, dur: 0.035, vol: 0.045 },
      { delay: 0.38, dur: 0.03, vol: 0.04 },
      { delay: 0.52, dur: 0.025, vol: 0.03 }
    ];

    claps.forEach(({ delay, dur, vol }) => {
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = 1 - i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900 + Math.random() * 400, t + delay);
      filter.Q.setValueAtTime(0.8, t + delay);
      gain.gain.setValueAtTime(vol, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(t + delay);
      source.stop(t + delay + dur + 0.01);
    });
  }

  playSad() {
    if (this.muted) return;
    this.init().then(() => this._ensureRunning()).then(() => this._playSadTone());
  }

  _playSadTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(165, t + 0.6);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  _ensureRunning() {
    if (this.ctx?.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  _playLevelUpTone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Arpeggio C4, E4, G4, C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.3);
    });
  }
}

function snapCoord(n) {
  return Math.round(n * 10) / 10;
}

function segmentKey(x1, y1, x2, y2) {
  const a = `${snapCoord(x1)},${snapCoord(y1)}`;
  const b = `${snapCoord(x2)},${snapCoord(y2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function parsePathSegments(d) {
  const segments = [];
  if (!d) return segments;

  const parts = d.trim().split(/(?=[MLZ])/i);
  let startPoint = null;
  let current = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const cmd = trimmed[0].toUpperCase();
    const nums = trimmed.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);

    if (cmd === 'M') {
      current = [nums[0], nums[1]];
      startPoint = [...current];
      for (let i = 2; i + 1 < nums.length; i += 2) {
        segments.push([current[0], current[1], nums[i], nums[i + 1]]);
        current = [nums[i], nums[i + 1]];
      }
    } else if (cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        segments.push([current[0], current[1], nums[i], nums[i + 1]]);
        current = [nums[i], nums[i + 1]];
      }
    } else if (cmd === 'Z' && current && startPoint) {
      segments.push([current[0], current[1], startPoint[0], startPoint[1]]);
    }
  }
  return segments;
}

function launchSadEffects(soundManager) {
  if (soundManager) soundManager.playSad();
  const overlay = document.createElement('div');
  overlay.className = 'sad-overlay';
  document.body.appendChild(overlay);
  for (let i = 0; i < 18; i++) {
    const drop = document.createElement('div');
    drop.className = 'sad-raindrop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 0.8}s`;
    drop.style.setProperty('--fall-dur', `${0.9 + Math.random() * 0.6}s`);
    overlay.appendChild(drop);
  }
  setTimeout(() => overlay.remove(), 2200);
}

let overlayScrollLockY = 0;

function openOverlayModal(html, { closeOnBackdrop = false } = {}) {
  const modal = document.createElement('div');
  modal.className = 'overlay-modal';
  modal.innerHTML = html;
  overlayScrollLockY = window.scrollY;
  document.body.style.top = `-${overlayScrollLockY}px`;
  document.body.classList.add('overlay-open');
  document.body.appendChild(modal);
  if (closeOnBackdrop) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeOverlayModal(modal);
    });
  }
  return modal;
}

function closeOverlayModal(modal) {
  modal.remove();
  if (!document.querySelector('.overlay-modal')) {
    document.body.classList.remove('overlay-open');
    document.body.style.top = '';
    window.scrollTo(0, overlayScrollLockY);
  }
}

function launchConfetti(soundManager) {
  if (soundManager) soundManager.playApplause();
  const container = document.createElement('div');
  container.className = 'confetti-container';
  const colors = ['#22c55e', '#00a2ff', '#fbbf24', '#a855f7', '#ef4444', '#14b8a6'];
  for (let i = 0; i < 70; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.background = colors[i % colors.length];
    particle.style.animationDelay = `${Math.random() * 0.35}s`;
    particle.style.setProperty('--x-drift', `${(Math.random() - 0.5) * 140}px`);
    container.appendChild(particle);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 2600);
}

// Zoom & Pan System for interactive SVG
class MapNavigator {
  constructor(svgElement, containerElement) {
    this.svg = svgElement;
    this.container = containerElement;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.isPinching = false;
    this.didDrag = false;
    this.pendingDrag = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startX = 0;
    this.startY = 0;
    this.lastPinchDistance = 0;
    
    this.setupListeners();
    this.updateTransform();
  }

  getPinchDistance(e) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  setupListeners() {
    const DRAG_THRESHOLD = 5;

    const beginPendingDrag = (clientX, clientY) => {
      this.pendingDrag = true;
      this.isDragging = false;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
      this.startX = clientX - this.panX;
      this.startY = clientY - this.panY;
    };

    const updatePendingDrag = (clientX, clientY) => {
      if (!this.pendingDrag || this.isDragging) return;
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.isDragging = true;
      this.didDrag = true;
      this.svg.classList.remove('smooth-transition');
      this.container.style.cursor = 'grabbing';
    };

    const endDrag = () => {
      this.pendingDrag = false;
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
      }
    };

    // Mouse Dragging for Panning — threshold so clicks on districts still fire
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.didDrag = false;
      beginPendingDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      updatePendingDrag(e.clientX, e.clientY);
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', endDrag);

    // Touch: pan (1 finger) and pinch-zoom (2 fingers)
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.pendingDrag = false;
        this.isDragging = false;
        this.isPinching = true;
        this.didDrag = false;
        this.lastPinchDistance = this.getPinchDistance(e);
        this.svg.classList.remove('smooth-transition');
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1) {
        this.isPinching = false;
        this.didDrag = false;
        beginPendingDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.isPinching) {
        const dist = this.getPinchDistance(e);
        if (this.lastPinchDistance > 0) {
          const scale = dist / this.lastPinchDistance;
          const oldZoom = this.zoom;
          this.zoom = Math.min(Math.max(this.zoom * scale, 0.8), 8);
          const rect = this.container.getBoundingClientRect();
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          this.panX = cx - (cx - this.panX) * (this.zoom / oldZoom);
          this.panY = cy - (cy - this.panY) * (this.zoom / oldZoom);
          this.updateTransform();
        }
        this.lastPinchDistance = dist;
        this.didDrag = true;
        e.preventDefault();
        return;
      }
      if (e.touches.length !== 1) return;
      updatePendingDrag(e.touches[0].clientX, e.touches[0].clientY);
      if (!this.isDragging) return;
      this.panX = e.touches[0].clientX - this.startX;
      this.panY = e.touches[0].clientY - this.startY;
      this.updateTransform();
      e.preventDefault();
    }, { passive: false });

    this.container.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.isPinching = false;
        this.lastPinchDistance = 0;
      }
      endDrag();
    });

    // Mouse Wheel Zoom (Silkier and dampened)
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      this.svg.classList.remove('smooth-transition'); // Pure 1:1 scroll feel
      const zoomFactor = 1.04; // Dampened from 1.1 for precise scroll control
      const oldZoom = this.zoom;
      
      if (e.deltaY < 0) {
        this.zoom = Math.min(this.zoom * zoomFactor, 8);
      } else {
        this.zoom = Math.max(this.zoom / zoomFactor, 0.8);
      }
      
      // Zoom toward cursor location
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom);
      this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
      
      this.updateTransform();
    }, { passive: false });
  }

  zoomIn() {
    this.svg.classList.add('smooth-transition');
    this.zoom = Math.min(this.zoom * 1.3, 8);
    this.updateTransform();
    setTimeout(() => this.svg.classList.remove('smooth-transition'), 400);
  }

  zoomOut() {
    this.svg.classList.add('smooth-transition');
    this.zoom = Math.max(this.zoom / 1.3, 0.8);
    this.updateTransform();
    setTimeout(() => this.svg.classList.remove('smooth-transition'), 400);
  }

  reset() {
    this.svg.classList.add('smooth-transition');
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
    setTimeout(() => this.svg.classList.remove('smooth-transition'), 400);
  }

  updateTransform() {
    this.svg.style.setProperty('--map-zoom', this.zoom);
    this.svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }
}

// Core Game Controller
class TunnelGame {
  constructor() {
    this.sounds = new SoundManager();
    this.mapNav = null;
    
    // Game States
    this.xp = 0;
    this.level = 1;
    this.streak = 0;
    this.bestStreak = 0;
    this.highScore = 0;
    this.unlockedLineIndex = 0;
    this.progressionMode = true; // false for unlocking all at once
    this.currentMode = 'EXPLORER'; // EXPLORER, LOCATE, QUIZ, TYPE_NAME, NAME_ALL
    this.activeSegment = 'STATIONS'; // STATIONS or LINES
    
    // Progress per Bezirk: { Altona: { solved: Set() }, ... }
    this.lineProgress = {};
    
    // Session states
    this.currentTarget = null; 
    this.currentChoices = [];
    this.achievements = new Set();
    this.trophies = new Set();
    this.activeSelectPath = null;
    
    // --- SPORCLE ROUND STATES ---
    this.inRound = false;
    this.roundTimeLeft = ROUND_TIME_LIMIT;
    this.roundStartedAt = null;
    this.roundQuestions = [];
    this.roundIndex = 0;
    this.roundCorrect = 0;
    this.roundIncorrect = 0;
    this.roundLineFilter = 'U1'; // Currently active round district
    this.roundHistory = {}; // stadtteilName -> { correct: bool, clickedName: string }
    
    // --- TYPE_NAME Autocomplete index ---
    this.autocompleteIndex = -1;
    this.nameAllInputTimer = null;
    this._alertStyleInjected = false;
    
    // --- NAME_ALL (Sporcle Countdown Challenge) States ---
    this.timerInterval = null;
    this.nameAllTimeLeft = ROUND_TIME_LIMIT;
    this.nameAllFound = new Set();
    this.nameAllIsActive = false;
    this.nameAllActiveLines = [];
    
    this.loadState();
  }

  getLineById(lineId) {
    return TRANSIT_LINES.find(l => l.id === lineId);
  }

  getStationByName(name) {
    return TRANSIT_STATIONS.find(s => s.name === name);
  }

  getStationById(id) {
    return TRANSIT_STATIONS.find(s => s.id === id);
  }

  getStationElementByName(name) {
    if (!this.svg || !name) return null;
    const st = this.getStationByName(name);
    const id = st?.id || name;
    return this.svg.querySelector(`.station-hit[data-id="${CSS.escape(id)}"], .station-dot[data-id="${CSS.escape(id)}"]`);
  }

  getLineElement(lineId) {
    if (!this.svg) return null;
    return this.svg.querySelector(`.line-path[data-line="${CSS.escape(lineId)}"]`);
  }

  highlightLine(lineId, cls = 'active') {
    document.querySelectorAll('.line-path').forEach(p => {
      p.classList.toggle(cls, p.getAttribute('data-line') === lineId);
      p.classList.toggle('dimmed', lineId && p.getAttribute('data-line') !== lineId);
    });
  }

  clearLineHighlights() {
    document.querySelectorAll('.line-path').forEach(p => {
      p.classList.remove('active', 'dimmed', 'blink', 'selected', 'round-correct', 'round-incorrect');
    });
  }

  getLineCssKey(lineId) {
    return (lineId || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  getLineColor(lineId) {
    const line = this.getLineById(lineId);
    return line?.color || '#009640';
  }

  getSegmentPool() {
    return this.activeSegment === 'LINES'
      ? TRANSIT_LINES.map(l => ({ name: l.id, id: l.id, lines: [l.id], type: l.mode }))
      : TRANSIT_STATIONS;
  }


  init() {
    // DOM bindings
    this.svg = document.querySelector('.transit-map-svg');
    this.mapWrapper = document.querySelector('.map-container-wrapper');
    this.tooltip = document.getElementById('map-tooltip');
    
    this.mapNav = new MapNavigator(this.svg, this.mapWrapper);
    this.reorderMapLayers();

    if (this.tooltip && this.tooltip.parentElement !== document.body) {
      document.body.appendChild(this.tooltip);
    }
    
    this.setupUIListeners();
    this.setupMobileMapHint();
    this.initMapPaths();
    this.renderStats();
    
    // Segment selectors binding
    this.setupSegmentSelectors();
    if (!this.isModeAllowedForSegment(this.currentMode)) {
      this.currentMode = 'EXPLORER';
    }
    this.applySegmentUI();
    this.syncSegmentBodyClass();
    this.setMode(this.resolveModeForCurrentSegment(this.currentMode));
    
    // Initial map unlock updates
    this.updateMapStates();
    
    const primeAudio = () => this.sounds.init();
    document.addEventListener('click', primeAudio);
    document.addEventListener('keydown', primeAudio);
    document.addEventListener('touchstart', primeAudio, { passive: true });

    // A–D shortcuts for Karten-Quiz / Bezirk-zuordnen
    document.addEventListener('keydown', (e) => this.handleQuizKeydown(e));
    
    // Check if onboarding is needed
    if (this.xp === 0) {
      this.showOnboarding(true);
    }
  }

  showOnboarding(force = false) {
    if (!force && localStorage.getItem('tq_onboarded')) return;
    openOverlayModal(`
      <div class="overlay-card onboarding-card">
        <h2>Willkommen bei TunnelQuiz 🚇</h2>
        <p>Lerne spielerisch die Hamburger U- und S-Bahn — Stationen und Linien auf der geografischen Karte.</p>
        <ul>
          <li><strong>Stationen lernen:</strong> Haltestellen finden, benennen und merken.</li>
          <li><strong>Linien lernen:</strong> U1–U4 und S-Bahn-Verläufe auf der Karte.</li>
          <li><strong>5 Spielmodi:</strong> Entdecker, Detektiv, Quiz, Tippen, Sporcle-Challenge.</li>
        </ul>
        <button class="primary-btn" id="btn-close-onboarding">Los geht's!</button>
      </div>
    `, { closeOnBackdrop: true });
    document.getElementById('btn-close-onboarding')?.addEventListener('click', () => {
      localStorage.setItem('tq_onboarded', '1');
      closeOverlayModal(document.querySelector('.overlay-modal'));
    });
  }

  switchSegment(segment) {
    if (this.activeSegment === segment) return;
    this.playSelectionSound();
    this.activeSegment = segment;
    this.saveState();
    this.applySegmentUI();
    this.resetMapClasses();
    this.clearMapTextLabels();
    this.updateMapStates();
    this.syncSegmentBodyClass();
    this.setMode(this.resolveModeForCurrentSegment(this.currentMode));
  }

  setupSegmentSelectors() {
    const btnSt = document.getElementById('btn-segment-stations');
    const btnBz = document.getElementById('btn-segment-lines');
    if (btnSt && btnBz) {
      btnSt.addEventListener('click', () => {
        if (this.inRound || this.nameAllIsActive) {
          if (!confirm("Runde läuft gerade. Segment wirklich wechseln und Runde abbrechen?")) return;
          this.endRound(false);
          this.stopNameAllChallenge(false);
        }
        this.switchSegment('STATIONS');
      });

      btnBz.addEventListener('click', () => {
        if (this.inRound || this.nameAllIsActive) {
          if (!confirm("Runde läuft gerade. Segment wirklich wechseln und Runde abbrechen?")) return;
          this.endRound(false);
          this.stopNameAllChallenge(false);
        }
        this.switchSegment('LINES');
      });
    }
  }

  setupMobileMapHint() {
    const hint = document.getElementById('map-hint-text');
    if (!hint) return;
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    hint.textContent = isTouch
      ? '💡 Tipp: Mit einem Finger verschieben, mit zwei Fingern zoomen. +/- Buttons nutzen.'
      : '💡 Tipp: Ziehe zum Verschieben. Mausrad oder Pinch zum Zoomen.';
  }

  setupUIListeners() {
    // Mode Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        
        if (this.inRound || this.nameAllIsActive) {
          if (!confirm("Aktiver Durchlauf läuft gerade. Modus wirklich wechseln und Durchlauf abbrechen?")) return;
          this.endRound(false);
          this.stopNameAllChallenge(false);
        }
        
        this.playSelectionSound();
        this.setMode(mode);
      });
    });

    // Zoom Buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => this.mapNav.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.mapNav.zoomOut());
    document.getElementById('btn-zoom-reset').addEventListener('click', () => this.mapNav.reset());

    // Game history & Settings
    const historyBtn = document.getElementById('btn-history');
    if (historyBtn) historyBtn.addEventListener('click', () => this.showGameHistory());
    document.getElementById('btn-settings').addEventListener('click', () => this.showSettings());

    // Sound Toggle
    const muteBtn = document.getElementById('btn-mute');
    muteBtn.innerHTML = this.sounds.muted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      const isMuted = this.sounds.toggleMute();
      muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
    });
    

    // Toggle Progression / All mode
    const toggleProgBtn = document.getElementById('toggle-progression');
    if (toggleProgBtn) {
      toggleProgBtn.checked = !this.progressionMode;
      toggleProgBtn.addEventListener('change', (e) => {
        this.progressionMode = !e.target.checked;
        this.updateMapStates();
        this.renderStats();
        if (this.currentMode !== 'EXPLORER' && !this.inRound && !this.nameAllIsActive) {
          this.nextQuestion();
        }
      });
    }
  }

  // Load state from local storage
  loadState() {
    this.xp = parseInt(localStorage.getItem('tq_xp')) || 0;
    this.streak = parseInt(localStorage.getItem('tq_streak')) || 0;
    this.bestStreak = parseInt(localStorage.getItem('tq_best_streak')) || 0;
    this.highScore = parseInt(localStorage.getItem('tq_highscore')) || 0;
    this.level = this.calculateLevel(this.xp);
    this.progressionMode = localStorage.getItem('tq_progression') !== 'false';
    const savedUnlockIdx = localStorage.getItem('tq_unlocked_bz_idx');
    if (savedUnlockIdx !== null) {
      this.unlockedLineIndex = Math.min(
        parseInt(savedUnlockIdx, 10) || 0,
        LINE_PROGRESSION.length - 1
      );
    } else {
      this.unlockedLineIndex = 0;
      for (let i = LINE_PROGRESSION.length - 1; i >= 0; i--) {
        if (this.xp >= LINE_PROGRESSION[i].xpNeeded) {
          this.unlockedLineIndex = i;
          break;
        }
      }
    }
    const savedMode = localStorage.getItem('tq_mode') || 'EXPLORER';
    this.currentMode = savedMode === 'BEZIRK_MATCH' ? 'EXPLORER' : savedMode;
    this.activeSegment = localStorage.getItem('tq_segment') || 'STATIONS';
    
    // Trophies (Pokale) — migrate legacy achievement IDs
    const savedTrophies = localStorage.getItem('tq_trophies');
    const legacyAchs = localStorage.getItem('tq_achievements');
    const trophyIds = savedTrophies || legacyAchs;
    if (trophyIds) {
      try {
        JSON.parse(trophyIds).forEach(id => {
          this.trophies.add(id);
          this.achievements.add(id);
        });
      } catch (e) {}
    }
    // Legacy island_finder → neuwerk_island
    if (this.trophies.has('island_finder')) {
      this.trophies.add('neuwerk_island');
    }

    // Load detailed Bezirk achievements
    LINE_PROGRESSION.forEach(line => {
      this.lineProgress[line.id] = { solved: new Set() };
      const saved = localStorage.getItem(`tq_progress_${line.id}`);
      if (saved) {
        try {
          JSON.parse(saved).forEach(st => this.lineProgress[line.id].solved.add(st));
        } catch(e) {}
      }
    });
  }

  // Save current game state
  saveState() {
    localStorage.setItem('tq_xp', this.xp);
    localStorage.setItem('tq_streak', this.streak);
    localStorage.setItem('tq_best_streak', this.bestStreak);
    localStorage.setItem('tq_highscore', this.highScore);
    localStorage.setItem('tq_unlocked_bz_idx', this.unlockedLineIndex);
    localStorage.setItem('tq_progression', this.progressionMode);
    localStorage.setItem('tq_mode', this.currentMode);
    localStorage.setItem('tq_segment', this.activeSegment);
    localStorage.setItem('tq_trophies', JSON.stringify([...this.trophies]));
    localStorage.setItem('tq_achievements', JSON.stringify([...this.trophies]));
    
    LINE_PROGRESSION.forEach(line => {
      localStorage.setItem(`tq_progress_${line.id}`, JSON.stringify([...this.lineProgress[line.id].solved]));
    });
  }

  calculateLevel(xp) {
    let currentLvl = 1;
    for (const rank of RANKS) {
      if (xp >= rank.minXp) {
        currentLvl = rank.level;
      }
    }
    return currentLvl;
  }

  // Award XP to player and handle leveling up
  addXp(amount, options = {}) {
    const { quiet = false } = options;
    const gained = amount * (this.streak >= 5 ? 2 : (this.streak >= 3 ? 1.5 : 1));
    const roundedGained = Math.round(gained);
    this.xp += roundedGained;
    
    if (this.xp > this.highScore) {
      this.highScore = this.xp;
    }
    
    const newLvl = this.calculateLevel(this.xp);
    if (newLvl > this.level) {
      this.level = newLvl;
      this.sounds.playLevelUp();
      if (!quiet) this.showLevelUpModal(newLvl);
    }
    
    this.saveState();
    if (!quiet) this.renderStats();
    return roundedGained;
  }

  resetStreak() {
    this.streak = 0;
    this.renderStats();
    this.saveState();
  }

  incrementStreak() {
    this.streak++;
    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
    }
    this.renderStats();
    this.saveState();
  }

  getLastUnlockedLine() {
    return LINE_PROGRESSION[this.unlockedLineIndex]?.id || LINE_PROGRESSION[0].id;
  }

  tryUnlockNextLine(frontierCorrect, frontierTotal) {
    if (!this.progressionMode) return null;
    if (frontierTotal <= 0) return null;
    const frontierPercent = Math.round((frontierCorrect / frontierTotal) * 100);
    if (frontierPercent < 75) return null;
    if (this.unlockedLineIndex >= LINE_PROGRESSION.length - 1) return null;

    const nextLine = LINE_PROGRESSION[this.unlockedLineIndex + 1];
    this.unlockedLineIndex++;
    this.saveState();
    this.updateMapStates();
    return nextLine.id;
  }

  getFrontierRoundScore() {
    const frontierLine = this.getLastUnlockedLine();
    let correct = 0;
    let total = 0;

    for (const q of this.roundQuestions) {
      const belongsToFrontier = this.activeSegment === 'LINES'
        ? q.name === frontierLine
        : (q.lines || []).includes(frontierLine);
      if (!belongsToFrontier) continue;
      total++;
      if (this.roundHistory[q.name]?.correct) correct++;
    }
    return { correct, total };
  }

  // Get list of currently unlocked Bezirke based on progression
  getUnlockedLines() {
    if (!this.progressionMode) {
      return LINE_PROGRESSION.map(line => line.id);
    }
    if (this.activeSegment === 'LINES') {
      return LINE_PROGRESSION.map(line => line.id);
    }
    return LINE_PROGRESSION
      .slice(0, this.unlockedLineIndex + 1)
      .map(line => line.id);
  }

  // Check if a specific stadtteil name is in unlocked Bezirke





  isStationUnlocked(name) {
    const info = this.getStationByName(name);
    if (!info) return false;
    return (info.lines || []).some(l => this.getUnlockedLines().includes(l));
  }

  markStationSolved(name) {
    const info = this.getStationByName(name);
    if (!info) return;
    (info.lines || []).forEach(lid => {
      if (!this.lineProgress[lid]) this.lineProgress[lid] = { solved: new Set() };
      this.lineProgress[lid].solved.add(name);
    });
    this.saveState();
  }

  isModeAllowedForSegment(mode) {
    if (this.activeSegment === 'LINES') {
      return !LINES_SEGMENT_HIDDEN_MODES.includes(mode);
    }
    return true;
  }

  resolveModeForCurrentSegment(mode = this.currentMode) {
    return this.isModeAllowedForSegment(mode) ? mode : 'EXPLORER';
  }

  updateModeVisibility() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      const mode = btn.dataset.mode;
      if (this.activeSegment === 'LINES' && LINES_SEGMENT_HIDDEN_MODES.includes(mode)) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }
    });
  }

  syncSegmentBodyClass() {
    document.body.classList.toggle('segment-lines', this.activeSegment === 'LINES');
    document.body.classList.toggle('segment-stations', this.activeSegment === 'STATIONS');
  }

  applySegmentUI() {
    const btnSt = document.getElementById('btn-segment-stations');
    const btnBz = document.getElementById('btn-segment-lines');
    const lockCard = document.getElementById('unlocker-card-container');
    if (btnSt && btnBz) {
      if (this.activeSegment === 'LINES') {
        btnBz.classList.add('active');
        btnSt.classList.remove('active');
        if (lockCard) lockCard.style.display = 'none';
      } else {
        btnSt.classList.add('active');
        btnBz.classList.remove('active');
        if (lockCard) lockCard.style.display = 'block';
      }
    }
    this.updateModeVisibility();
    this.updateLocateModeLabel();
  }

  updateLocateModeLabel() {
    const locateBtn = document.getElementById('mode-locate');
    if (!locateBtn) return;
    const labelRow = locateBtn.querySelector('div');
    if (!labelRow) return;
    const spans = labelRow.querySelectorAll('span');
    if (spans[0]) {
      spans[0].textContent = this.activeSegment === 'LINES' ? 'Linien-Detektiv' : 'Stations-Detektiv';
    }
    if (spans[1]) {
      spans[1].textContent = this.activeSegment === 'LINES'
        ? 'Finde die Linie auf der Karte'
        : 'Finde die Station auf der Karte';
    }
  }

  recordRoundProgress(stadtteilName, options = {}) {
    if (!stadtteilName) return;
    const { skipMapRefresh = false, skipStats = false } = options;
    this.markStationSolved(stadtteilName);
    if (!skipMapRefresh) this.updateMapStates();
    if (!skipStats) this.renderStats();
  }

  nextQuestion() {
    const playArea = document.getElementById('game-play-area');
    if (!playArea || this.inRound || this.nameAllIsActive) return;
    const mode = this.resolveModeForCurrentSegment(this.currentMode);
    if (mode === 'EXPLORER') this.initExplorerMode(playArea);
    else if (mode === 'NAME_ALL') this.initNameAllMode(playArea);
    else this.initGameMode(playArea);
  }

  // Render score, progress-fill, XP etc.
  renderStats() {
    const xpVal = document.getElementById('stat-xp');
    const streakVal = document.getElementById('stat-streak');
    const bestStreakVal = document.getElementById('stat-best-streak');
    const rankName = document.getElementById('stat-rank');
    const progFill = document.getElementById('progress-fill');
    
    xpVal.textContent = this.xp;
    streakVal.textContent = `${this.streak}x`;
    if (bestStreakVal) bestStreakVal.textContent = `Beste: ${this.bestStreak}x`;
    
    const currentRank = RANKS.find(r => r.level === this.level);
    rankName.textContent = currentRank ? currentRank.name : "Steig-Neuling";
    
    // Level progress bar
    if (this.level < 5) {
      const nextRank = RANKS.find(r => r.level === this.level + 1);
      const currentMin = currentRank.minXp;
      const nextMin = nextRank.minXp;
      const progressPercent = ((this.xp - currentMin) / (nextMin - currentMin)) * 100;
      progFill.style.width = `${Math.min(progressPercent, 100)}%`;
    } else {
      progFill.style.width = '100%';
    }

    // Progression Unlock Panel Update
    this.renderUnlockProgress();
  }

  renderUnlockProgress() {
    const listContainer = document.getElementById('line-progress-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    const unlocked = this.getUnlockedLines();
    
    LINE_PROGRESSION.forEach(line => {
      const isUnlocked = unlocked.includes(line.id);
      const totalInDistrict = TRANSIT_STATIONS.filter(d => (d.lines || []).includes(line.id)).length;
      const solvedInDistrict = this.lineProgress[line.id]?.solved.size || 0;
      const percent = totalInDistrict > 0 ? Math.round((solvedInDistrict / totalInDistrict) * 100) : 0;
      
      const row = document.createElement('div');
      row.className = `district-progress-row ${isUnlocked ? 'unlocked' : 'locked'}`;
      if (isUnlocked && solvedInDistrict < totalInDistrict) {
        row.classList.add('active-unlock');
      }
      
      const cssKey = this.getLineCssKey(line.id);
      const color = this.getLineColor(line.id);
      
      row.innerHTML = `
        <div class="dp-indicator line-color-indicator" style="background: ${color}; box-shadow: 0 0 6px ${color};"></div>
        <div class="dp-name">${line.id}</div>
        ${isUnlocked ? 
          `<div class="dp-score">${solvedInDistrict}/${totalInDistrict} (${percent}%)</div>` : 
          `<div class="dp-lock">🔒 75% in vorheriger Linie</div>`
        }
      `;
      
      listContainer.appendChild(row);
      
      if (solvedInDistrict === totalInDistrict && totalInDistrict > 0) {
        this.unlockAchievement(`master_${cssKey}`, `${line.id}-Entdecker 🏆`, `Meistere alle Stationen der Linie ${line.id}.`);
      }
    });
  }

  unlockTrophy(id, title, desc) {
    if (this.trophies.has(id)) return;
    this.trophies.add(id);
    this.achievements.add(id);
    this.saveState();
    this.showAchievementAlert(title, desc);
  }


  playSelectionSound() {
    this.sounds.init();
    this.sounds.playSelect();
  }

  syncMapPromptBar({ title, target, sub, highlight = false, isHtml = false }) {
    const bar = document.getElementById('map-prompt-bar');
    if (!bar) return;

    const mapTitle = document.getElementById('map-prompt-title');
    const mapTarget = document.getElementById('map-prompt-target');
    const mapSub = document.getElementById('map-prompt-sub');

    if (mapTitle) mapTitle.textContent = title;
    if (mapTarget) {
      if (isHtml) mapTarget.innerHTML = target;
      else mapTarget.textContent = target;
      mapTarget.classList.toggle('highlight', highlight);
    }
    if (mapSub) mapSub.textContent = sub;

    if (this.inRound) bar.hidden = false;
  }

  hideMapPromptBar() {
    const bar = document.getElementById('map-prompt-bar');
    if (bar) bar.hidden = true;
  }

  setInRoundUI(active) {
    document.body.classList.toggle('in-round', active);
    if (!active) this.hideMapPromptBar();
  }

  unlockAchievement(id, title, desc) {
    this.unlockTrophy(id, title, desc);
  }


  stopActiveTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateRoundTimerDisplay() {
    const display = document.getElementById('round-timer-display');
    if (!display) return;
    const minutes = Math.floor(this.roundTimeLeft / 60);
    const seconds = this.roundTimeLeft % 60;
    display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    display.classList.toggle('timer-warning', this.roundTimeLeft <= 60);
  }

  startRoundTimer() {
    this.stopActiveTimer();
    this.roundTimeLeft = ROUND_TIME_LIMIT;
    this.roundStartedAt = Date.now();
    this.updateRoundTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.roundTimeLeft--;
      this.updateRoundTimerDisplay();
      if (this.roundTimeLeft <= 0) {
        this.stopActiveTimer();
        if (this.inRound) this.finishRound({ timedOut: true });
      }
    }, 1000);
  }

  getRoundElapsedSeconds() {
    if (this.roundStartedAt) {
      return Math.min(ROUND_TIME_LIMIT, Math.round((Date.now() - this.roundStartedAt) / 1000));
    }
    return ROUND_TIME_LIMIT - this.roundTimeLeft;
  }

  showAchievementAlert(title, desc) {
    // Create an elegant glass sliding panel alert
    const alertBox = document.createElement('div');
    alertBox.className = 'glass-card achievement-alert';
    alertBox.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 10000;
      border-color: var(--color-xp);
      box-shadow: 0 10px 30px rgba(255, 191, 0, 0.2);
      max-width: 320px;
      display: flex;
      flex-direction: row;
      gap: 0.75rem;
      align-items: center;
      padding: 1rem;
      animation: alertSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      background: rgba(17, 24, 39, 0.9);
    `;
    
    alertBox.innerHTML = `
      <div style="font-size: 2rem;">🏆</div>
      <div>
        <div style="font-weight:700; color:#fff; font-size:0.95rem; margin-bottom: 0.15rem;">Erfolg freigeschaltet!</div>
        <div style="font-weight:700; color:var(--color-xp); font-size:0.85rem; margin-bottom: 0.15rem;">${title}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${desc}</div>
      </div>
    `;
    
    document.body.appendChild(alertBox);
    
    if (!this._alertStyleInjected) {
      const style = document.createElement('style');
      style.id = 'alert-style';
      style.innerHTML = `
        @keyframes alertSlideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes alertSlideOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      this._alertStyleInjected = true;
    }

    setTimeout(() => {
      alertBox.style.animation = 'alertSlideOut 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      setTimeout(() => alertBox.remove(), 500);
    }, 5000);
  }

  showLevelUpModal(lvl) {
    const rank = RANKS.find(r => r.level === lvl);
    const modal = openOverlayModal(`
      <div class="modal-content">
        <h2 style="font-size: 2.2rem; color: var(--color-xp); text-shadow: 0 0 15px rgba(255, 191, 0, 0.3);">🎉 Aufstieg! 🎉</h2>
        <p style="margin-top:0.5rem; font-weight:700; font-size: 1.1rem; color:#fff;">Du bist jetzt im Rang: ${rank.name}</p>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Dein hanseatisches Wissen wächst! Meistere noch mehr Stadtteile, um der ultimative HVV-Experte zu werden.</p>
        <button class="primary-btn" id="btn-lvl-dismiss">Weiter geht's!</button>
      </div>
    `);
    launchConfetti(this.sounds);
    document.getElementById('btn-lvl-dismiss').addEventListener('click', () => closeOverlayModal(modal));
  }

  resetGame() {
    if (!confirm("Wirklich alles zurücksetzen? XP, Streak, Fortschritt und Achievements werden gelöscht. Das kann nicht rückgängig gemacht werden.")) return;
    // Remove all tq_ keys and mute setting
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('tq_') || k === 'tq_muted' || k === 'tq_game_history');
    keysToRemove.forEach(k => localStorage.removeItem(k));
    location.reload();
  }

  loadGameHistory() {
    try {
      const raw = localStorage.getItem('tq_game_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  recordGameHistory(entry) {
    const history = this.loadGameHistory();
    history.unshift({ ...entry, date: new Date().toISOString() });
    if (history.length > 50) history.length = 50;
    localStorage.setItem('tq_game_history', JSON.stringify(history));
  }

  getModeDisplayName(mode, segment) {
    const seg = segment || this.activeSegment;
    if (mode === 'LOCATE') {
      return seg === 'LINES' ? 'Linien-Detektiv' : 'Stations-Detektiv';
    }
    return MODE_LABELS[mode] || mode;
  }

  formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  getRankProgressInfo() {
    const currentRank = RANKS.find(r => r.level === this.level) || RANKS[0];
    const nextRank = RANKS.find(r => r.level === this.level + 1);
    let percent = 100;
    if (nextRank) {
      const span = nextRank.minXp - currentRank.minXp;
      percent = span > 0 ? Math.min(100, ((this.xp - currentRank.minXp) / span) * 100) : 0;
    }
    return { currentRank, nextRank, percent };
  }

  renderRankLadderHtml() {
    const { currentRank, nextRank, percent } = this.getRankProgressInfo();
    const steps = RANKS.map(rank => {
      let state = 'upcoming';
      if (rank.level < this.level) state = 'passed';
      else if (rank.level === this.level) state = 'current';
      const xpHint = rank.level < RANKS.length
        ? `${rank.minXp} XP`
        : `${rank.minXp}+ XP`;
      return `
        <div class="rank-ladder-step rank-ladder-step--${state}">
          <div class="rank-ladder-dot"></div>
          <div class="rank-ladder-label">
            <span class="rank-ladder-name">${rank.name}</span>
            <span class="rank-ladder-xp">${xpHint}</span>
          </div>
        </div>
      `;
    }).join('');

    const progressNote = nextRank
      ? `${Math.round(percent)}% bis ${nextRank.name} (${nextRank.minXp} XP)`
      : 'Höchster Rang erreicht';

    return `
      <div class="log-rank-section">
        <h3 class="log-section-title">Dein Rang</h3>
        <p class="log-rank-current"><strong>${currentRank.name}</strong> · ${this.xp} XP</p>
        <div class="rank-ladder">${steps}</div>
        <div class="rank-xp-bar"><div class="rank-xp-bar-fill" style="width:${percent}%"></div></div>
        <p class="log-rank-progress-note">${progressNote}</p>
        <div class="log-xp-hints">
          <p class="log-xp-hint">XP: Jede richtige Antwort im Detektiv-Modus gibt je +15 XP · im Quiz &amp; beim Namen eingeben je +10 XP · Im „Nenne alle Stationen“-Modus je +6 pro Treffer.</p>
          <p class="log-xp-hint">Serien schalten XP-Boni frei: Ab 3: ×1,5 · ab 5: ×2.</p>
          <p class="log-xp-hint">Linien schaltest du separat über den Linien-Fortschritt frei.</p>
        </div>
      </div>
    `;
  }

  renderTrophyGalleryHtml() {
    const won = this.trophies.size;
    const total = TROPHY_CATALOG.length;
    const tiles = TROPHY_CATALOG.map(trophy => {
      const earned = this.trophies.has(trophy.id);
      return `
        <div class="trophy-tile ${earned ? 'trophy-tile--earned' : 'trophy-tile--locked'}" title="${trophy.desc}">
          <span class="trophy-icon">${trophy.icon}</span>
          <span class="trophy-name">${trophy.name}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="log-trophy-section">
        <h3 class="log-section-title">Pokale (${won} / ${total})</h3>
        <div class="trophy-gallery">${tiles}</div>
      </div>
    `;
  }

  showGameHistory() {
    const history = this.loadGameHistory();

    let listHtml;
    if (history.length === 0) {
      listHtml = '<p class="log-empty-hint">Noch keine Spiele gespielt. Starte eine Runde!</p>';
    } else {
      listHtml = `<div class="game-history-list">${history.map(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const scoreColor = item.percent >= 75 ? 'var(--color-correct)' : 'var(--color-incorrect)';
        const districts = item.districts?.length ? item.districts.join(', ') : '—';
        const durationHtml = item.durationSec != null
          ? `<div class="gh-duration">⏱ ${this.formatDuration(item.durationSec)}</div>`
          : '';
        return `
          <div class="game-history-item">
            <div class="gh-date">${dateStr} · ${timeStr}</div>
            <div class="gh-mode">${this.getModeDisplayName(item.mode, item.segment)}${item.segment === 'LINES' ? ' (Linien)' : ''}</div>
            <div class="gh-districts">${districts}</div>
            <div class="gh-score" style="color:${scoreColor};">${item.correct} / ${item.total} (${item.percent}%)</div>
            ${durationHtml}
          </div>
        `;
      }).join('')}</div>`;
    }

    const modal = openOverlayModal(`
      <div class="modal-content log-modal-content">
        <h2>📋 Log</h2>
        ${this.renderTrophyGalleryHtml()}
        ${this.renderRankLadderHtml()}
        <div class="log-history-section">
          <h3 class="log-section-title">Spielverlauf</h3>
          ${listHtml}
        </div>
        <button class="primary-btn" id="btn-history-close">Schließen</button>
      </div>
    `, { closeOnBackdrop: true });
    document.getElementById('btn-history-close').addEventListener('click', () => closeOverlayModal(modal));
  }

  showSettings() {
    const modal = openOverlayModal(`
      <div class="modal-content" style="max-width: 400px;">
        <h2>⚙️ Einstellungen</h2>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 1rem 0;">
        <div class="settings-privacy-block" style="margin-bottom: 1.2rem;">
          <strong style="display:block; margin-bottom: 0.4rem;">🔒 Datenschutz</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.5;">Keine Server, keine Accounts. Dein Spielstand wird nur lokal im Browser gespeichert (localStorage) und nicht an Dritte übermittelt. Beim Löschen des Browser-Verlaufs geht der Fortschritt verloren.</p>
        </div>
        <div style="margin-bottom: 1.2rem;">
          <strong style="display:block; margin-bottom: 0.4rem;">🗑️ Spielstand zurücksetzen</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 0.8rem 0;">Löscht alle XP, Achievements und Fortschritte. Frischer Start als Steig-Neuling.</p>
          <button id="btn-settings-reset" style="background: rgba(220,50,50,0.2); border: 1px solid rgba(220,50,50,0.5); color: #ff6b6b; padding: 0.5rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem;">↺ Neustart</button>
        </div>
        <button class="primary-btn" id="btn-settings-close" style="margin-top: 0.5rem;">Schließen</button>
      </div>
    `, { closeOnBackdrop: true });
    document.getElementById('btn-settings-close').addEventListener('click', () => closeOverlayModal(modal));
    document.getElementById('btn-settings-reset').addEventListener('click', () => this.resetGame());
  }

  // Mode Setter
  setMode(mode) {
    mode = this.resolveModeForCurrentSegment(mode);
    this.currentMode = mode;
    this.saveState();
    
    // Update active button state
    document.querySelectorAll('.mode-btn').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Reset temporary classes
    this.resetMapClasses();
    this.clearMapTextLabels();
    
    // Stop round / timer when switching modes
    if (this.inRound) this.endRound(false);
    if (this.nameAllIsActive) this.stopNameAllChallenge(false);

    // Configure specific Mode details
    const playArea = document.getElementById('game-play-area');
    playArea.innerHTML = '';
    
    this.currentTarget = null;
    
    if (mode === 'EXPLORER') {
      this.initExplorerMode(playArea);
    } else if (mode === 'NAME_ALL') {
      this.initNameAllMode(playArea);
    } else {
      this.initGameMode(playArea);
    }

    this.updateModeVisibility();
  }

  // Update map visual styles based on current unlocked states and discoveries




  /** On wrong map click: highlight only the correct target in red; wrong pick stays neutral */
  revealMissedTarget(targetName, isBezirk = false) {
    if (isBezirk) {
      const missedLine = this.getLineElement(targetName); if (missedLine) missedLine.classList.add('round-incorrect');
      this.addMapTextLabel(targetName, targetName, 'incorrect');
    } else {
      const path = this.getStationElementByName(targetName);
      if (path) path.classList.add('round-incorrect');
      this.addMapTextLabel(targetName, targetName, 'incorrect');
    }
  }

  handleQuizKeydown(e) {
    if (!this.inRound || this.currentMode !== 'QUIZ') return;
    if (e.target.matches('input, textarea, select')) return;

    const idx = { a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
    if (idx === undefined || !this.currentChoices || idx >= this.currentChoices.length) return;

    const buttons = document.querySelectorAll('#game-options-container .choice-btn');
    const btn = buttons[idx];
    if (!btn || btn.style.pointerEvents === 'none') return;

    e.preventDefault();
    this.sounds.init();
    this.handleRoundAnswer(this.currentChoices[idx], btn);
  }

  // Initialize Map paths and binding event listeners



  shouldShowMapTooltip() {
    if (this.nameAllIsActive) return false;
    if (this.mapNav?.isDragging || this.mapNav?.isPinching) return false;
    if (this.inRound) return false;
    return true;
  }


  positionMapTooltip(clientX, clientY) {
    if (!this.tooltip) return;
    const offsetX = 14;
    const offsetY = 12;
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.display = 'block';
    this.tooltip.style.position = 'fixed';
    const rect = this.tooltip.getBoundingClientRect();
    const w = rect.width || 160;
    const h = rect.height || 40;
    let x = clientX + offsetX;
    let y = clientY - h - offsetY;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.style.transform = 'none';
    this.tooltip.style.visibility = 'visible';
  }


  updateMapStates() {
    const unlockedLines = this.getUnlockedLines();

    document.querySelectorAll('.station-group, .station-hit, .station-dot').forEach(el => {
      const lines = (el.getAttribute('data-lines') || '').split(',').filter(Boolean);
      const isUnlocked = this.progressionMode
        ? lines.some(l => unlockedLines.includes(l))
        : true;
      el.classList.toggle('locked-path', !isUnlocked);
      el.classList.toggle('unlocked-line', isUnlocked);
      const name = el.getAttribute('data-name');
      const showDiscovered = this.currentMode === 'EXPLORER' && !this.inRound && !this.nameAllIsActive;
      let discovered = false;
      if (showDiscovered && name) {
        for (const lid of lines) {
          if (this.lineProgress[lid]?.solved.has(name)) { discovered = true; break; }
        }
      }
      el.classList.toggle('discovered', discovered);
    });

    document.querySelectorAll('.line-path').forEach(path => {
      const lid = path.getAttribute('data-line');
      const isUnlocked = !this.progressionMode || unlockedLines.includes(lid);
      path.classList.toggle('locked-path', !isUnlocked);
      path.style.pointerEvents = isUnlocked ? '' : 'none';
    });
  }

  resetMapClasses() {
    document.querySelectorAll('.station-hit, .station-dot').forEach(el => {
      el.classList.remove('selected', 'blink', 'correct-flash', 'incorrect-flash', 'round-correct', 'round-incorrect', 'line-excluded');
    });
    this.clearLineHighlights();
    this.activeSelectPath = null;
  }

  applyActiveLineFilter(activeLines) {
    if (!activeLines?.length) return;
    const all = this.getUnlockedLines();
    if (activeLines.length >= all.length) return;
    document.querySelectorAll('.station-group').forEach(g => {
      const lines = (g.getAttribute('data-lines') || '').split(',').filter(Boolean);
      const visible = lines.some(l => activeLines.includes(l));
      g.classList.toggle('line-excluded', !visible);
      g.querySelectorAll('.station-hit').forEach(h => {
        h.style.pointerEvents = visible ? '' : 'none';
      });
    });
  }

  initMapPaths() {
    document.querySelectorAll('.station-hit').forEach(hit => {
      hit.addEventListener('mousemove', (e) => this.showStationTooltip(hit, e.clientX, e.clientY));
      hit.addEventListener('mouseleave', () => { if (this.tooltip) this.tooltip.style.display = 'none'; });
      hit.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        this.showStationTooltip(hit, e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      hit.addEventListener('mousedown', () => { if (this.mapNav) this.mapNav.didDrag = false; });
      hit.addEventListener('click', (e) => {
        if (this.mapNav?.didDrag) return;
        const name = hit.getAttribute('data-name');
        const id = hit.getAttribute('data-id');
        if (hit.classList.contains('locked-path') && !this.nameAllIsActive) {
          this.sounds.init(); this.sounds.playIncorrect(); return;
        }
        if (this.currentMode === 'EXPLORER' && this.activeSegment === 'STATIONS') {
          this.selectStation(hit, name, id);
        } else if (this.inRound && this.currentMode === 'LOCATE' && this.activeSegment === 'STATIONS') {
          this.handleStationLocateClick(hit, name);
        } else if (this.inRound && this.currentMode === 'QUIZ' && this.activeSegment === 'STATIONS') {
          this.handleRoundAnswer(name, null);
        }
      });
    });

    document.querySelectorAll('.line-path').forEach(path => {
      path.addEventListener('mousemove', (e) => this.showLineTooltip(path, e.clientX, e.clientY));
      path.addEventListener('mouseleave', () => { if (this.tooltip) this.tooltip.style.display = 'none'; });
      path.addEventListener('mousedown', () => { if (this.mapNav) this.mapNav.didDrag = false; });
      path.addEventListener('click', () => {
        if (this.mapNav?.didDrag) return;
        const lineId = path.getAttribute('data-line');
        if (path.classList.contains('locked-path') && !this.nameAllIsActive) {
          this.sounds.init(); this.sounds.playIncorrect(); return;
        }
        if (this.currentMode === 'EXPLORER' && this.activeSegment === 'LINES') {
          this.selectLine(lineId);
        } else if (this.inRound && this.currentMode === 'LOCATE' && this.activeSegment === 'LINES') {
          this.handleLineLocateClick(lineId);
        } else if (this.inRound && this.currentMode === 'QUIZ' && this.activeSegment === 'LINES') {
          this.handleRoundAnswer(lineId, null);
        }
      });
    });
  }

  reorderMapLayers() {
    if (!this.svg) return;
    const bg = this.svg.querySelector('.map-bg-group');
    const lines = this.svg.querySelector('.lines-group');
    const stations = this.svg.querySelector('.stations-group');
    const labels = this.svg.querySelector('#map-labels-group');
    if (bg) this.svg.insertBefore(bg, this.svg.firstChild);
    if (lines && stations) this.svg.insertBefore(lines, stations);
    if (labels) this.svg.appendChild(labels);
  }

  showStationTooltip(el, clientX, clientY) {
    if (!this.shouldShowMapTooltip() || !this.tooltip) return;
    const name = el.getAttribute('data-name');
    const lines = (el.getAttribute('data-lines') || '').replace(/,/g, ', ');
    if (el.classList.contains('locked-path')) {
      this.tooltip.innerHTML = '<div>🔒 Linie gesperrt</div><div class="tooltip-bezirk">Lerne weiter zum Freischalten</div>';
    } else {
      this.tooltip.innerHTML = `<div>${name}</div><div class="tooltip-bezirk">${lines}</div>`;
    }
    this.positionMapTooltip(clientX, clientY);
    this.tooltip.style.display = 'block';
  }

  showLineTooltip(path, clientX, clientY) {
    if (!this.shouldShowMapTooltip() || !this.tooltip) return;
    const lineId = path.getAttribute('data-line');
    const line = this.getLineById(lineId);
    const count = line?.stationIds?.length || 0;
    this.tooltip.innerHTML = `<div>Linie ${lineId}</div><div class="tooltip-bezirk">${count} Stationen · ${line?.mode === 'ubahn' ? 'U-Bahn' : 'S-Bahn'}</div>`;
    this.positionMapTooltip(clientX, clientY);
    this.tooltip.style.display = 'block';
  }

  selectStationByName(name) {
    const el = this.getStationElementByName(name);
    if (el) this.selectStation(el, name, el.getAttribute('data-id'));
  }

  selectStation(el, name, id) {
    this.playSelectionSound();
    this.resetMapClasses();
    el.classList.add('selected');
    this.activeSelectPath = el;
    const info = this.getStationByName(name) || { lines: [], type: 'both' };
    const lines = info.lines || [];
    const typeLabel = info.type === 'both' ? 'U- & S-Bahn' : (info.type === 'ubahn' ? 'U-Bahn' : 'S-Bahn');
    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div class="info-details">
        <div class="detail-header">
          <h2>${name}</h2>
          <span class="bezirk-tag" style="background: rgba(0,114,188,0.15); color: #7ec8ff; border: 1px solid rgba(0,114,188,0.3)">${typeLabel}</span>
        </div>
        <div class="detail-stats-grid">
          <div class="detail-stat"><div class="ds-label">Linien</div><div class="ds-value">${lines.join(', ') || '—'}</div></div>
          <div class="detail-stat"><div class="ds-label">Umsteigen</div><div class="ds-value">${lines.length > 1 ? 'Ja' : 'Nein'}</div></div>
        </div>
        <div class="detail-trivia">${lines.length > 1 ? `Wichtiger Umsteigeknoten — ${lines.length} Linien.` : `Station der Linie ${lines[0] || '?'}.`}</div>
      </div>`;
  }

  selectLine(lineId) {
    this.playSelectionSound();
    this.resetMapClasses();
    this.highlightLine(lineId, 'selected');
    const line = this.getLineById(lineId);
    const stations = (line?.stationIds || []).map(id => this.getStationById(id)?.name).filter(Boolean);
    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div class="info-details">
        <div class="detail-header">
          <h2>Linie ${lineId}</h2>
          <span class="bezirk-tag" style="background: ${line?.color || '#009640'}22; color: ${line?.color || '#009640'}; border: 1px solid ${line?.color || '#009640'}55">${line?.mode === 'ubahn' ? 'U-Bahn' : 'S-Bahn'}</span>
        </div>
        <div class="detail-stat"><div class="ds-label">Stationen (${stations.length})</div>
          <div style="font-size:0.78rem; max-height:120px; overflow-y:auto; color:var(--text-secondary); line-height:1.35; padding-top:0.2rem;">${stations.join(' → ')}</div>
        </div>
      </div>`;
  }

  handleStationLocateClick(el, name) {
    this.handleRoundAnswer(name, null);
  }

  handleLineLocateClick(lineId) {
    this.handleRoundAnswer(lineId, null);
  }

  // --- MODE: EXPLORER (ENTDECKER) ---
  initExplorerMode(container) {
    const isBz = this.activeSegment === 'LINES';
    container.innerHTML = `
      <div id="explorer-details" class="empty-info">
        <div class="ei-icon">${isBz ? '🏢' : '🗺️'}</div>
        <p>Klicke auf ${isBz ? 'eine Linie' : 'eine Station'} auf der Karte, um Linien, Umsteigeinfos und Fakten anzuzeigen!</p>
      </div>
    `;
    this.updateMapStates();
  }





  // --- CORE GAME MODES & SPORCLE ROUNDS ---
  initGameMode(container) {
    const isBz = this.activeSegment === 'LINES';
    
    container.innerHTML = `
      <div class="game-play-area">
        <!-- Play / Round Controls -->
        <div class="round-setup-card" id="round-setup-ui" style="display: flex; flex-direction: column; gap: 0.75rem; text-align: center;">
          <div style="font-size: 1.8rem;">🎮</div>
          <h4 style="font-family: var(--font-display); font-weight:700; color: #fff;">Durchlauf starten</h4>
          <p style="font-size:0.82rem; color: var(--text-secondary);">
            Lerne fokussiert in geschlossenen Runden wie bei Sporcle. Richtige/falsche Antworten bleiben markiert!
            <br><strong>Zeitlimit: 10 Minuten.</strong>
            ${this.progressionMode && !isBz ? '<br><strong style="color: var(--color-xp);">Schalte die nächste Linie frei mit ≥75% in der zuletzt freigeschalteten Linie!</strong>' : ''}
          </p>
          
          ${!isBz ? `
          <div style="text-align: left; display:flex; flex-direction:column; gap:0.35rem;">
            <label style="font-size:0.75rem; color: var(--text-muted); font-weight:600;">Linien einbeziehen:</label>
            <div class="line-picker" id="line-picker">
              ${this.getUnlockedLines().map((b, i) => `
                <label class="line-picker-item">
                  <input type="checkbox" value="${b}" ${i === 0 ? 'checked' : ''}>
                  <span>${b}</span>
                </label>
              `).join('')}
            </div>
          </div>` : ''}

          <button class="primary-btn" id="btn-start-round" style="margin-top:0.4rem; padding: 0.75rem;">Beginnen</button>
        </div>

        <!-- Active round dashboard (hidden initially) -->
        <div id="round-active-ui" style="display:none; flex-direction:column;">
          <div class="prompt-box" style="margin-bottom:1rem;">
            <div class="prompt-title" id="game-prompt-title">...</div>
            <div class="prompt-target" id="game-prompt-target">Bereit?</div>
            <div class="prompt-sub" id="game-prompt-sub">Wähle deine Linien...</div>
          </div>
          
          <div class="timer-display" id="round-timer-display">10:00</div>
          <!-- Round Indicators -->
          <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.6rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom: 0.75rem;">
            <div id="round-questions-count" style="font-weight: 700; color: #fff;">Frage 0/0</div>
            <div style="display:flex; gap:0.75rem;">
              <span style="color: var(--color-correct); font-weight:700;">🟢 <span id="round-correct-count">0</span></span>
              <span style="color: var(--color-incorrect); font-weight:700;">🔴 <span id="round-incorrect-count">0</span></span>
            </div>
          </div>
          <div class="round-progress-bar">
            <div class="round-progress-fill" id="round-progress-fill"></div>
          </div>
          
          <div id="game-options-container" class="choices-grid">
            <!-- Options or text input will be injected here -->
          </div>

          <button type="button" class="secondary-btn danger-outline" id="btn-cancel-round" style="margin-top: 1rem;">Runde abbrechen</button>
        </div>
      </div>
    `;

    const startBtn = document.getElementById('btn-start-round');
    startBtn.addEventListener('click', () => {
      this.sounds.init();
      if (this.activeSegment === 'LINES') {
        this.startRound(null);
        return;
      }
      const selected = this.getSelectedRoundLines();
      if (!selected.length) {
        alert('Bitte wähle mindestens eine Linie aus.');
        return;
      }
      this.startRound(selected);
    });

    const bezirkPicker = document.getElementById('line-picker');
    if (bezirkPicker) {
      bezirkPicker.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) this.playSelectionSound();
      });
    }
  }

  getSelectedRoundLines() {
    const picker = document.getElementById('line-picker');
    if (!picker) return [];
    return Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  }

  // --- SPORCLE ROUND CONTROL FUNCTIONS ---
  startRound(districtSelection) {
    if (this.inRound) return;

    if (!document.getElementById('round-setup-ui')) {
      const playArea = document.getElementById('game-play-area');
      if (playArea) this.initGameMode(playArea);
    }

    this.sounds.init();
    this.resetMapClasses();
    this.clearMapTextLabels();
    this.updateMapStates();
    
    this.inRound = true;
    this.roundLineFilter = districtSelection;
    this.roundCorrect = 0;
    this.roundIncorrect = 0;
    this.roundIndex = 0;
    this.roundHistory = {};

    // Build question pool
    if (this.activeSegment === 'LINES') {
      this.roundQuestions = LINE_PROGRESSION.map(line => ({ name: line.id, id: line.id })).sort(() => Math.random() - 0.5);
    } else {
      const selectedLines = Array.isArray(districtSelection) ? districtSelection : [districtSelection];
      const pool = TRANSIT_STATIONS.filter(d => selectedLines.some(l => (d.lines || []).includes(l)));
      this.roundQuestions = pool.sort(() => Math.random() - 0.5);
    }

    if (this.roundQuestions.length === 0) {
      alert("Fehler: Keine Fragen für die ausgewählten Linien gefunden!");
      this.inRound = false;
      return;
    }

    if (this.activeSegment === 'STATIONS' && Array.isArray(districtSelection)) {
      this.applyActiveLineFilter(districtSelection);
    }

    // Toggle UI Card elements
    document.getElementById('round-setup-ui').style.display = 'none';
    document.getElementById('round-active-ui').style.display = 'flex';

    this.setInRoundUI(true);
    
    this.startRoundTimer();
    this.nextRoundQuestion();
  }

  nextRoundQuestion() {
    this.activeSelectPath = null;
    
    // Remove blink state
    document.querySelectorAll('.station-hit, .station-dot, .line-path').forEach(p => p.classList.remove('blink', 'selected'));

    if (this.roundIndex >= this.roundQuestions.length) {
      this.finishRound();
      return;
    }

    this.currentTarget = this.roundQuestions[this.roundIndex];
    
    // Update counters
    document.getElementById('round-questions-count').textContent = `Frage ${this.roundIndex + 1} von ${this.roundQuestions.length}`;
    document.getElementById('round-correct-count').textContent = this.roundCorrect;
    document.getElementById('round-incorrect-count').textContent = this.roundIncorrect;
    
    const fillPercent = (this.roundIndex / this.roundQuestions.length) * 100;
    document.getElementById('round-progress-fill').style.width = `${fillPercent}%`;

    const promptTitle = document.getElementById('game-prompt-title');
    const promptTarget = document.getElementById('game-prompt-target');
    const promptSub = document.getElementById('game-prompt-sub');
    const optionsContainer = document.getElementById('game-options-container');
    
    optionsContainer.innerHTML = '';
    
    // Mode specific prompt loading
    const isBz = this.activeSegment === 'LINES';
    let promptData = { title: '', target: '', sub: '', highlight: false, isHtml: false };

    if (this.currentMode === 'LOCATE') {
      promptData = {
        title: isBz ? "Finde die Linie" : "Finde die Station",
        target: this.currentTarget.name,
        sub: isBz ? "Klicke ihn auf der Karte an!" : `Linien: ${(this.currentTarget.lines || []).join(', ')}. Klicke ihn an!`,
        highlight: true
      };
    } 
    else if (this.currentMode === 'QUIZ') {
      promptData = {
        title: isBz ? "Welche Linie ist hervorgehoben?" : "Welche Station blinkt?",
        target: isBz ? "❔ Hervorgehobene Linie ❔" : "❔ Blinkende Station ❔",
        sub: "Wähle die passende Antwort aus den Optionen!",
        highlight: false,
        isHtml: true
      };
      
      // Blink target path
      if (isBz) {
        const blinkLine = this.getLineElement(this.currentTarget.name); if (blinkLine) blinkLine.classList.add('blink');
      } else {
        const targetPath = this.getStationElementByName(this.currentTarget.name);
        if (targetPath) targetPath.classList.add('blink');
      }

      this.generateMCROptions(optionsContainer);
    }
    else if (this.currentMode === 'TYPE_NAME') {
      promptData = {
        title: isBz ? "Linie benennen" : "Station benennen",
        target: isBz ? "Welche Linie ist hervorgehoben?" : "Welche Station blinkt?",
        sub: "Tippe den Namen ein — bei richtiger Eingabe zählt er sofort.",
        highlight: false
      };

      if (isBz) {
        const blinkLine = this.getLineElement(this.currentTarget.name); if (blinkLine) blinkLine.classList.add('blink');
      } else {
        const targetPath = this.getStationElementByName(this.currentTarget.name);
        if (targetPath) targetPath.classList.add('blink');
      }

      this.generateTypingField(optionsContainer);
    }

    promptTitle.textContent = promptData.title;
    if (promptData.isHtml) promptTarget.innerHTML = promptData.target;
    else promptTarget.textContent = promptData.target;
    promptTarget.classList.toggle('highlight', promptData.highlight);
    promptSub.textContent = promptData.sub;
    this.syncMapPromptBar(promptData);

    // Bind Cancel round button
    document.getElementById('btn-cancel-round').onclick = () => this.endRound(true);
  }

  getAlreadyAnsweredInRound() {
    const answered = new Set();
    const isBz = this.activeSegment === 'LINES';
    document.querySelectorAll('.line-path.round-correct, .line-path.round-incorrect').forEach(p => {
      if (isBz) answered.add(p.getAttribute('data-line'));
    });
    document.querySelectorAll('.station-hit.round-correct, .station-hit.round-incorrect').forEach(p => {
      if (!isBz) answered.add(p.getAttribute('data-name'));
    });
    Object.keys(this.roundHistory).forEach(name => answered.add(name));
    return answered;
  }

  // Generate MC Choices for QUIZ
  generateMCROptions(container) {
    const isBz = this.activeSegment === 'LINES';
    const answered = this.getAlreadyAnsweredInRound();
    const choices = new Set([this.currentTarget.name]);

    let pool = [];
    if (isBz) {
      pool = LINE_PROGRESSION.map(line => line.id).filter(n => !answered.has(n) && n !== this.currentTarget.name);
    } else {
      pool = this.roundQuestions.map(q => q.name).filter(n => !answered.has(n) && n !== this.currentTarget.name);
      if (pool.length < 3) {
        pool = TRANSIT_STATIONS.filter(d => d.name && !answered.has(d.name) && d.name !== this.currentTarget.name).map(d => d.name);
      }
    }

    const maxChoices = Math.min(4, pool.length + 1);
    while (choices.size < maxChoices && pool.length > 0) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      choices.add(pick);
    }

    this.currentChoices = Array.from(choices).sort(() => Math.random() - 0.5);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    this.currentChoices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span>${choice}</span><span class="choice-letter">${letters[idx] || ''}</span>`;
      btn.addEventListener('click', () => this.handleRoundAnswer(choice, btn));
      container.appendChild(btn);
    });
  }

  // Generate typing guess field (no name suggestions — pure recall)
  generateTypingField(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input-field';
    input.placeholder = this.activeSegment === 'LINES' ? 'Linienname eingeben...' : 'Stationsname eingeben...';
    input.id = 'type-name-input';
    input.setAttribute('autocomplete', 'off');
    
    wrapper.appendChild(input);
    container.appendChild(wrapper);

    input.focus();

    const cleanStr = str => str.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (!val || !this.currentTarget || input.style.pointerEvents === 'none') return;
      if (cleanStr(val) === cleanStr(this.currentTarget.name)) {
        this.submitTypingGuess(val);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitTypingGuess(input.value.trim());
      }
    });
  }

  handleAutocompleteInput(input, dropdown) {
    const text = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    this.autocompleteIndex = -1;

    if (text.length < 1) {
      dropdown.style.display = 'none';
      return;
    }

    // Build suggestion list
    let pool = [];
    if (this.activeSegment === 'LINES') {
      pool = LINE_PROGRESSION.map(line => line.id);
    } else {
      pool = TRANSIT_STATIONS.filter(d => d.name).map(d => d.name);
    }

    const matches = pool.filter(name => name.toLowerCase().includes(text)).slice(0, 5);

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    matches.forEach((match, idx) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = match;
      div.onclick = () => {
        input.value = match;
        dropdown.style.display = 'none';
        input.focus();
      };
      dropdown.appendChild(div);
    });

    dropdown.style.display = 'block';
  }

  handleAutocompleteKeys(e, input, dropdown) {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    
    if (dropdown.style.display === 'block' && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex + 1) % items.length;
        this.updateActiveSuggestion(items);
      }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.autocompleteIndex = (this.autocompleteIndex - 1 + items.length) % items.length;
        this.updateActiveSuggestion(items);
      }
      else if (e.key === 'Enter' && this.autocompleteIndex >= 0) {
        e.preventDefault();
        input.value = items[this.autocompleteIndex].textContent;
        dropdown.style.display = 'none';
        this.autocompleteIndex = -1;
      }
      else if (e.key === 'Enter') {
        e.preventDefault();
        this.submitTypingGuess(input.value.trim());
      }
      else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        this.autocompleteIndex = -1;
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitTypingGuess(input.value.trim());
      }
    }
  }

  updateActiveSuggestion(items) {
    items.forEach((item, idx) => {
      if (idx === this.autocompleteIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  submitTypingGuess(typedValue) {
    if (!typedValue || !this.currentTarget) return;
    this.sounds.init();

    const correctAnswer = this.currentTarget.name;
    const cleanStr = str => str.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
    const isCorrect = cleanStr(typedValue) === cleanStr(correctAnswer);
    const input = document.getElementById('type-name-input');
    const isBz = this.activeSegment === 'LINES';

    if (!isCorrect) {
      this.sounds.playIncorrect();
      this.resetStreak();
      this.roundIncorrect++;
      document.getElementById('round-incorrect-count').textContent = this.roundIncorrect;
      this.revealMissedTarget(correctAnswer, isBz);
      if (input) {
        input.style.pointerEvents = 'none';
        input.classList.add('input-shake');
      }
      document.getElementById('game-prompt-sub').innerHTML =
        `<span style="color: var(--color-incorrect); font-weight:700;">Falsch! Richtig wäre: ${correctAnswer}</span>`;
      this.roundHistory[correctAnswer] = { correct: false };
      this.roundIndex++;
      setTimeout(() => this.nextRoundQuestion(), 2400);
      return;
    }

    if (input) input.style.pointerEvents = 'none';
    this.sounds.init();
    this.roundCorrect++;
    this.incrementStreak();
    const xp = this.addXp(10);
    this.sounds.playCorrect();

    if (isBz) {
      const correctLine = this.getLineElement(correctAnswer); if (correctLine) correctLine.classList.add('round-correct');
      this.addMapTextLabel(correctAnswer, correctAnswer, 'correct');
    } else {
      const correctPath = this.getStationElementByName(correctAnswer);
      if (correctPath) correctPath.classList.add('round-correct');
      this.addMapTextLabel(correctAnswer, correctAnswer, 'correct');
      this.recordRoundProgress(correctAnswer);
      // checkParadiseTrophy removed: this.checkParadiseTrophy(correctAnswer);
    }

    document.getElementById('game-prompt-sub').innerHTML = `<span style="color: var(--color-correct); font-weight:700;">Richtig! +${xp} XP</span>`;

    this.roundHistory[correctAnswer] = { correct: true };
    this.roundIndex++;
    setTimeout(() => this.nextRoundQuestion(), 1200);
  }

  // Answer handler for MCQ (and map clicks in QUIZ)
  handleRoundAnswer(selectedAnswer, chosenBtn) {
    if (!this.inRound || !this.currentTarget) return;
    this.sounds.init();

    const correctAnswer = this.currentTarget.name;
    const isCorrect = selectedAnswer === correctAnswer;

    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.style.pointerEvents = 'none';
      const textSpan = btn.querySelector('span');
      if (textSpan && textSpan.textContent === correctAnswer) btn.classList.add('correct');
    });
    if (chosenBtn) chosenBtn.style.pointerEvents = 'none';

    const isBz = this.activeSegment === 'LINES';
    
    // Stop blinking
    if (isBz) {
      const unblinkLine = this.getLineElement(this.currentTarget.name); if (unblinkLine) unblinkLine.classList.remove('blink');
    } else {
      const targetPath = this.getStationElementByName(this.currentTarget.name);
      if (targetPath) targetPath.classList.remove('blink', 'selected');
    }

    if (isCorrect) {
      this.roundCorrect++;
      this.incrementStreak();
      const xp = this.addXp(10);
      this.sounds.playCorrect();

      // Highlight map
      if (isBz) {
        const correctLine = this.getLineElement(correctAnswer);
        if (correctLine) correctLine.classList.add('round-correct');
        this.addMapTextLabel(correctAnswer, correctAnswer, 'correct');
      } else {
        const correctPath = this.getStationElementByName(correctAnswer);
        if (correctPath) correctPath.classList.add('round-correct');
        this.addMapTextLabel(correctAnswer, correctAnswer, 'correct');
        this.recordRoundProgress(correctAnswer);
        // checkParadiseTrophy removed: this.checkParadiseTrophy(correctAnswer);
      }

      document.getElementById('game-prompt-sub').innerHTML = `<span style="color: var(--color-correct); font-weight:700;">Richtig! +${xp} XP</span>`;
      
      this.roundHistory[correctAnswer] = { correct: true };
      this.roundIndex++;
      setTimeout(() => this.nextRoundQuestion(), 1200);
    } else {
      this.roundIncorrect++;
      this.resetStreak();
      this.sounds.playIncorrect();

      if (chosenBtn) chosenBtn.classList.add('incorrect');

      this.revealMissedTarget(correctAnswer, isBz);

      document.getElementById('game-prompt-sub').innerHTML = `<span style="color: var(--color-incorrect); font-weight:700;">Falsch! Richtig wäre: ${correctAnswer}</span>`;
      
      this.roundHistory[correctAnswer] = { correct: false };
      this.roundIndex++;
      setTimeout(() => this.nextRoundQuestion(), 2400);
    }
  }

  // Answer handler for Locate click on map


  getPathCentroid(path) {
    if (!path) return { x: 300, y: 300 };
    try {
      const box = path.getBBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    } catch (e) {
      return { x: 300, y: 300 };
    }
  }

  getLineCentroid(lineId) {
    const path = this.getLineElement(lineId);
    if (!path) return { x: 300, y: 300 };
    try {
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(len / 2);
      return { x: pt.x, y: pt.y };
    } catch (e) {
      return { x: 300, y: 300 };
    }
  }

  labelIdForKey(key) {
    return `lbl-${String(key).replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  // --- SVG LABEL OVERLAY SYSTEM ---
  addMapTextLabel(targetKey, labelText, variant = 'neutral') {
    const labelGroup = document.getElementById('map-labels-group');
    if (!labelGroup) return;

    const id = this.labelIdForKey(targetKey);
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    let centroid;
    const path = this.getStationElementByName(targetKey);
    if (path) {
      centroid = this.getPathCentroid(path);
    } else if (LINE_PROGRESSION.some(l => l.id === targetKey)) {
      centroid = this.getLineCentroid(targetKey);
    } else {
      return;
    }

    const shortLabel = labelText.length > 18 ? `${labelText.slice(0, 16)}…` : labelText;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', centroid.x.toFixed(2));
    text.setAttribute('y', centroid.y.toFixed(2));
    text.setAttribute('class', `map-text-label label-${variant}`);
    text.setAttribute('id', id);
    text.textContent = shortLabel;
    labelGroup.appendChild(text);
  }

  clearMapTextLabels() {
    const labelGroup = document.getElementById('map-labels-group');
    if (labelGroup) labelGroup.innerHTML = '';
  }

  // --- ROUND FINISHED SUMMARY ENGINE ---
  finishRound(options = {}) {
    const { timedOut = false } = options;
    if (!this.inRound) return;
    this.stopActiveTimer();
    const durationSec = this.getRoundElapsedSeconds();
    this.inRound = false;
    this.setInRoundUI(false);
    
    const total = this.roundQuestions.length;
    const percent = Math.round((this.roundCorrect / total) * 100);
    const passed = percent >= 75;

    // progression: unlock next Bezirk when frontier Bezirk scored ≥75% in any mode
    let unlockCongrat = '';
    const isBz = this.activeSegment === 'LINES';
    const roundBezirke = Array.isArray(this.roundLineFilter) ? this.roundLineFilter : [this.roundLineFilter];

    if (this.progressionMode) {
      const { correct: fCorrect, total: fTotal } = this.getFrontierRoundScore();
      const frontierPercent = fTotal > 0 ? Math.round((fCorrect / fTotal) * 100) : 0;
      const unlockedNext = this.tryUnlockNextLine(fCorrect, fTotal);

      if (unlockedNext) {
        unlockCongrat = `<br><h3 style="color: var(--color-xp); margin: 0.5rem 0;">🎉 Linie freigeschaltet: ${unlockedNext}!</h3>`;
      } else if (fTotal > 0 && frontierPercent < 75 && this.unlockedLineIndex < LINE_PROGRESSION.length - 1) {
        unlockCongrat = `<br><span style="color: var(--color-incorrect); font-weight:700;">${this.getLastUnlockedLine()}: ${frontierPercent}% — mindestens 75% nötig, um die nächste Linie freizuschalten.</span>`;
      }
    }

    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: center; padding: 0.5rem;">
        <div style="font-size: 2.2rem;">🏁</div>
        <h3 style="font-family: var(--font-display); font-weight:700; color: #fff;">Runde beendet!</h3>
        ${timedOut ? '<p style="font-size:0.85rem; color:var(--color-incorrect); font-weight:700;">⏱ Zeit abgelaufen (10 Minuten).</p>' : ''}
        <p style="font-size:0.85rem; color:var(--text-secondary);">Spieldauer: <strong>${this.formatDuration(durationSec)}</strong></p>
        
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.4rem;">
          <div>
            <div style="font-size:0.75rem; color: var(--text-muted);">Ergebnis</div>
            <div style="font-size:1.4rem; font-weight:700; color: ${passed ? 'var(--color-correct)' : 'var(--color-incorrect)'};">${this.roundCorrect} / ${total}</div>
          </div>
          <div>
            <div style="font-size:0.75rem; color: var(--text-muted);">Erfolgsquote</div>
            <div style="font-size:1.4rem; font-weight:700; color: ${passed ? 'var(--color-correct)' : 'var(--color-incorrect)'};">${percent}%</div>
          </div>
        </div>

        ${unlockCongrat}

        <div class="round-end-actions">
          <button class="primary-btn" id="btn-restart-round">Nochmal spielen</button>
          <button class="secondary-btn" id="btn-exit-round">Beenden</button>
        </div>
      </div>
    `;

    if (percent === 100) launchConfetti(this.sounds);
    else if (percent < 50) launchSadEffects(this.sounds);

    this.recordGameHistory({
      mode: this.currentMode,
      segment: this.activeSegment,
      districts: roundBezirke,
      correct: this.roundCorrect,
      total,
      percent,
      passed,
      durationSec
    });

    document.getElementById('btn-restart-round').onclick = () => {
      this.resetMapClasses();
      this.clearMapTextLabels();
      this.updateMapStates();
      const playArea = document.getElementById('game-play-area');
      if (playArea) this.initGameMode(playArea);
    };
    document.getElementById('btn-exit-round').onclick = () => this.setMode(this.currentMode);

    this.renderStats();
    this.saveState();
  }

  // End active round immediately
  endRound(showUI = true) {
    this.stopActiveTimer();
    this.inRound = false;
    this.setInRoundUI(false);
    this.resetMapClasses();
    this.clearMapTextLabels();
    if (showUI) this.setMode(this.currentMode);
  }


  // --- MODE: NAME_ALL (SPORCLE COUNTDOWN CHALLENGE) ---
  initNameAllMode(container) {
    this.nameAllFound.clear();
    this.nameAllIsActive = false;
    this.nameAllTimeLeft = ROUND_TIME_LIMIT;
    const isBz = this.activeSegment === 'LINES';
    const placeLabel = isBz ? 'Bezirke' : 'Stadtteile';
    const pickerBezirke = isBz ? LINE_PROGRESSION.map(line => line.id) : this.getUnlockedLines();

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.75rem; text-align:center;" id="name-all-setup">
        <div style="font-size:2.2rem;">⏱️</div>
        <h4 style="font-family:var(--font-display); font-weight:700; color:#fff;">Nenne alle ${placeLabel}!</h4>
        <p style="font-size:0.82rem; color:var(--text-secondary);">
          Wie viele Hamburger ${placeLabel} kannst du aus dem Kopf nennen? 
          Tippe sie ein. Richtige leuchten sofort grün auf!
          <br><strong>Zeitlimit: 10:00 Minuten.</strong>
        </p>
        ${!isBz ? `
        <div style="text-align: left; display:flex; flex-direction:column; gap:0.35rem;">
          <label style="font-size:0.75rem; color: var(--text-muted); font-weight:600;">Linien einbeziehen:</label>
          <div class="line-picker" id="nameall-line-picker">
            ${pickerBezirke.map(b => `
              <label class="line-picker-item">
                <input type="checkbox" value="${b}" checked>
                <span>${b}</span>
              </label>
            `).join('')}
          </div>
        </div>` : ''}
        <button class="primary-btn" id="btn-start-nameall" style="padding:0.75rem;">Beginnen</button>
      </div>

      <div style="display:none; flex-direction:column; gap:0.6rem;" id="name-all-active">
        <div class="timer-display" id="timer-display">10:00</div>
        
        <div style="background: rgba(0,0,0,0.15); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.5rem; display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
          <span style="font-weight:700; color:#fff;">Gefunden:</span>
          <span style="font-weight:700; color:var(--color-correct);" id="name-all-counter">0 / 104</span>
        </div>

        <input type="text" class="text-input-field" id="name-all-input" placeholder="Gib einen Namen ein..." autocomplete="off">

        <div class="action-btn-row" style="margin-top:0.4rem;">
          <button type="button" class="secondary-btn" id="btn-pause-nameall">Pause</button>
          <button type="button" class="secondary-btn danger-outline" id="btn-giveup-nameall">Aufgeben</button>
        </div>
      </div>
    `;

    document.getElementById('btn-start-nameall').onclick = () => {
      const selected = isBz ? LINE_PROGRESSION.map(line => line.id) : this.getSelectedNameAllLines();
      if (!selected.length) {
        alert('Bitte wähle mindestens eine Linie aus.');
        return;
      }
      this.startNameAllChallenge(selected);
    };
  }

  getSelectedNameAllLines() {
    const picker = document.getElementById('nameall-line-picker');
    if (!picker) return [];
    return Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  }

  getNameAllPool(bezirke) {
    if (this.activeSegment === 'LINES') {
      return bezirke.map(name => ({ name, bezirk: name }));
    }
    return TRANSIT_STATIONS.filter(d => selectedLines.some(l => (d.lines || []).includes(l)));
  }

  startNameAllChallenge(selectedBezirke) {
    this.sounds.init();
    this.resetMapClasses();
    this.clearMapTextLabels();

    this.nameAllActiveLines = selectedBezirke;
    
    // Hide unlocked segment overlays if progression is on, to make it completely blank
    document.querySelectorAll('.stadtteil-path').forEach(p => {
      p.classList.remove('locked-path', 'unlocked-bezirk', 'discovered');
      p.style.fill = '';
      p.style.stroke = '';
      p.style.pointerEvents = 'none';
    });
    this.applyActiveLineFilter(selectedBezirke);
    this.svg?.classList.add('name-all-active');
    this.raiseWaterLayerForNameAll();

    this.nameAllFound.clear();
    this.nameAllIsActive = true;
    this.nameAllTimeLeft = ROUND_TIME_LIMIT;

    document.getElementById('name-all-setup').style.display = 'none';
    document.getElementById('name-all-active').style.display = 'flex';

    const countLabel = document.getElementById('name-all-counter');
    const totalCount = this.getNameAllPool(selectedBezirke).length;
    countLabel.textContent = `0 / ${totalCount}`;

    const input = document.getElementById('name-all-input');
    input.value = '';
    input.focus();

    if (this._nameAllInputHandler) {
      input.removeEventListener('input', this._nameAllInputHandler);
    }
    this._nameAllInputHandler = () => {
      clearTimeout(this.nameAllInputTimer);
      this.nameAllInputTimer = setTimeout(() => this.checkNameAllInput(input, totalCount), 150);
    };
    input.addEventListener('input', this._nameAllInputHandler);

    // Bind Controls
    const pauseBtn = document.getElementById('btn-pause-nameall');
    pauseBtn.onclick = () => this.toggleNameAllPause(pauseBtn);

    const giveupBtn = document.getElementById('btn-giveup-nameall');
    giveupBtn.onclick = () => this.stopNameAllChallenge(true); // surrender

    // Start Timer
    this.stopActiveTimer();
    this.timerInterval = setInterval(() => this.tickNameAll(), 1000);
  }

  tickNameAll() {
    if (!this.nameAllIsActive) return;

    this.nameAllTimeLeft--;
    
    const minutes = Math.floor(this.nameAllTimeLeft / 60);
    const seconds = this.nameAllTimeLeft % 60;
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const display = document.getElementById('timer-display');
    if (display) {
      display.textContent = formatted;
      display.classList.toggle('timer-warning', this.nameAllTimeLeft <= 60);
    }

    if (this.nameAllTimeLeft <= 0) {
      this.stopNameAllChallenge(true); // time out
    }
  }

  toggleNameAllPause(btn) {
    this.nameAllIsActive = !this.nameAllIsActive;
    
    const input = document.getElementById('name-all-input');
    if (this.nameAllIsActive) {
      btn.textContent = 'Pause';
      if (input) {
        input.disabled = false;
        input.focus();
      }
      this.timerInterval = setInterval(() => this.tickNameAll(), 1000);
    } else {
      btn.textContent = 'Weiter';
      if (input) input.disabled = true;
      this.stopActiveTimer();
    }
  }

  checkNameAllInput(input, totalCount) {
    if (!this.nameAllIsActive) return;
    const val = input.value.trim();
    if (val.length < 2) return;

    const cleanStr = str => str.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
    const cleanVal = cleanStr(val);
    const isBz = this.activeSegment === 'LINES';

    let matchName = null;
    if (isBz) {
      const bz = LINE_PROGRESSION.find(line =>
        cleanStr(b.name) === cleanVal && this.nameAllActiveLines.includes(b.name)
      );
      if (bz) matchName = bz.name;
    } else {
      const match = TRANSIT_STATIONS.find(d =>
        cleanStr(d.name) === cleanVal &&
        
        this.nameAllActiveLines.includes(d.bezirk)
      );
      if (match) matchName = match.name;
    }
    
    if (matchName && !this.nameAllFound.has(matchName)) {
      this.nameAllFound.add(matchName);
      this.sounds.playCorrect();
      this.incrementStreak();

      if (isBz) {
        document.querySelectorAll(`.stadtteil-path[data-bezirk="${matchName}"]`).forEach(p => {
          p.classList.add('round-correct');
        });
        this.addMapTextLabel(matchName, matchName, 'correct');
      } else {
        const correctPath = this.getStationElementByName(matchName);
        if (correctPath) {
          correctPath.classList.add('round-correct');
          this.addMapTextLabel(matchName, matchName, 'correct');
        }
        this.recordRoundProgress(matchName, { skipMapRefresh: true, skipStats: true });
        // checkParadiseTrophy removed: this.checkParadiseTrophy(matchName);
      }

      this.addXp(6, { quiet: true });

      document.getElementById('name-all-counter').textContent = `${this.nameAllFound.size} / ${totalCount}`;

      input.value = '';
      
      if (this.nameAllFound.size === totalCount) {
        this.stopNameAllChallenge(false);
      }
    }
  }

  stopNameAllChallenge(surrender = true) {
    this.nameAllIsActive = false;
    this.svg?.classList.remove('name-all-active');
    this.reorderMapLayers();
    const durationSec = ROUND_TIME_LIMIT - this.nameAllTimeLeft;
    this.stopActiveTimer();

    const totalCount = this.getNameAllPool(this.nameAllActiveLines).length;
    const foundCount = this.nameAllFound.size;
    const percent = totalCount > 0 ? Math.round((foundCount / totalCount) * 100) : 0;

    // If surrender or timeout, reveal all missing in red and label them!
    if (surrender) {
      const missing = this.getNameAllPool(this.nameAllActiveLines).filter(d => !this.nameAllFound.has(d.name));
      let idx = 0;
      const revealBatch = () => {
        const slice = missing.slice(idx, idx + 12);
        slice.forEach(d => {
          if (this.activeSegment === 'LINES') {
            document.querySelectorAll(`.stadtteil-path[data-bezirk="${d.name}"]`).forEach(p => {
              p.classList.add('round-incorrect');
            });
            this.addMapTextLabel(d.name, d.name, 'incorrect');
          } else {
            const path = this.getStationElementByName(d.name);
            if (path) {
              path.classList.add('round-incorrect');
              this.addMapTextLabel(d.name, d.name, 'incorrect');
            }
          }
        });
        idx += 12;
        if (idx < missing.length) {
          requestAnimationFrame(revealBatch);
        }
      };
      requestAnimationFrame(revealBatch);
      this.sounds.playIncorrect();
      this.resetStreak();
    } else {
      this.sounds.playLevelUp();
      launchConfetti(this.sounds);
      if (this.activeSegment === 'STATIONS') {
        this.unlockAchievement("meister_alle_stationen", "Netzplan-König 👑", "Finde alle Stadtteile in der Sporcle-Challenge!");
      } else {
        this.unlockAchievement("meister_alle_linien", "Linien-Kapitän 🏛️", "Benenne alle sieben Bezirke in der Challenge!");
      }
    }

    if (this.progressionMode && this.activeSegment === 'STATIONS') {
      const frontierLine = this.getLastUnlockedLine();
      const frontierPool = this.getNameAllPool([frontierLine]);
      const frontierFound = frontierPool.filter(d => this.nameAllFound.has(d.name)).length;
      this.tryUnlockNextLine(frontierFound, frontierPool.length);
    }

    if (percent < 50 && (surrender || percent < 100)) {
      launchSadEffects(this.sounds);
    }

    this.recordGameHistory({
      mode: 'NAME_ALL',
      segment: this.activeSegment,
      districts: this.nameAllActiveLines.length ? this.nameAllActiveLines : ['Alle Stadtteile'],
      correct: foundCount,
      total: totalCount,
      percent,
      passed: !surrender && foundCount === totalCount,
      durationSec
    });

    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.75rem; text-align:center; padding: 0.5rem;">
        <div style="font-size:2.2rem;">⏱️</div>
        <h3 style="font-family:var(--font-display); font-weight:700; color:#fff;">Challenge beendet!</h3>
        
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.25rem;">
          ${surrender ? 'Du hast aufgegeben oder die Zeit ist abgelaufen. Alle fehlenden Orte leuchten rot auf der Karte.' : 'Unglaublich! Du hast JEDEN EINZELNEN Stadtteil gefunden!'}
        </p>
        <p style="font-size:0.85rem; color:var(--text-secondary);">Spieldauer: <strong>${this.formatDuration(durationSec)}</strong></p>

        <div style="background: rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.75rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Gefunden</div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--color-correct);">${foundCount} / ${totalCount}</div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Quote</div>
            <div style="font-size:1.4rem; font-weight:700; color:var(--color-correct);">${percent}%</div>
          </div>
        </div>

        <div class="round-end-actions" style="margin-top:0.5rem;">
          <button class="secondary-btn" id="btn-exit-nameall">Beenden & Karte aufräumen</button>
        </div>
      </div>
    `;

    document.getElementById('btn-exit-nameall').onclick = () => {
      this.resetMapClasses();
      this.clearMapTextLabels();
      this.setMode(this.currentMode);
    };

    this.updateMapStates();
    this.renderStats();
    this.saveState();
  }
}

// Global initialization when page loads
window.addEventListener('DOMContentLoaded', () => {
  const game = new TunnelGame();
  game.init();
  window.tunnelGame = game;
});
