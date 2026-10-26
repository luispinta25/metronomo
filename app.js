"use strict";

/* ---------- Utilidades ---------- */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
try { localStorage.removeItem("metro.pin"); } catch { /* sin almacenamiento */ }

/* ---------- Catálogos ---------- */
// Cada timbre se sintetiza: play(tiempo, nivel 0=fuerte 1=medio 2=débil, ganancia).
const SOUNDS = {
  click:    { name: "Clic",     play: (t, i, g) => tone(t, "square", [1900, 1400, 1050][i], g * 0.7, 0.03) },
  madera:   { name: "Madera",   play: (t, i, g) => tone(t, "triangle", [950, 700, 520][i], g * 0.9, 0.055) },
  bloque:   { name: "Bloque",   play: (t, i, g) => tone(t, "sine", [1250, 940, 720][i], g * 0.9, 0.09) },
  suave:    { name: "Suave",    play: (t, i, g) => tone(t, "sine", [880, 660, 520][i], g * 0.9, 0.14) },
  digital:  { name: "Digital",  play: (t, i, g) => tone(t, "sine", [1000, 800, 620][i], g * 0.8, 0.06) },
  gota:     { name: "Gota",     play: (t, i, g) => tone(t, "sine", [900, 800, 700][i], g, 0.09, [1800, 1600, 1400][i]) },
  marimba:  { name: "Marimba",  play: (t, i, g) => { const f = [523, 440, 349][i]; tone(t, "sine", f, g, 0.18); tone(t, "sine", f * 4, g * 0.25, 0.05); } },
  campana:  { name: "Campana",  play: (t, i, g) => { const f = [1320, 1100, 880][i]; tone(t, "sine", f, g * 0.6, 0.4); tone(t, "sine", f * 2.76, g * 0.3, 0.25); tone(t, "sine", f * 5.4, g * 0.15, 0.12); } },
  cencerro: { name: "Cencerro", play: (t, i, g) => { const f = [800, 700, 600][i]; tone(t, "square", f, g * 0.28, 0.22); tone(t, "square", f * 0.675, g * 0.28, 0.22); } },
  palillos: { name: "Palillos", play: (t, i, g) => { noiseBurst(t, g * 0.9, 0.025, "bandpass", [3500, 3000, 2600][i], 4); tone(t, "triangle", 1800, g * 0.4, 0.02); } },
  hihat:    { name: "Hi-hat",   play: (t, i, g) => noiseBurst(t, g * 0.9, i === 0 ? 0.09 : 0.04, "highpass", 7000, 0.7) },
  caja:     { name: "Caja",     play: (t, i, g) => { noiseBurst(t, g * 0.8, 0.12, "bandpass", 1800, 0.8); tone(t, "triangle", [220, 200, 180][i], g * 0.6, 0.08, 120); } },
  bombo:    { name: "Bombo",    play: (t, i, g) => tone(t, "sine", [150, 130, 110][i], g * 1.4, 0.16, 45) },
};
// Cada patrón divide el pulso en "div" partes; hits marca cuáles suenan (0 = silencio).
const PATTERNS = [
  { id: "negra", name: "Negra", div: 1, hits: [1] },
  { id: "corcheas", name: "Corcheas", div: 2, hits: [1, 1] },
  { id: "contratiempo", name: "Contratiempo", div: 2, hits: [0, 1] },
  { id: "tresillo", name: "Tresillo", div: 3, hits: [1, 1, 1] },
  { id: "swing", name: "Swing", div: 3, hits: [1, 0, 1] },
  { id: "tres-sin1", name: "Tresillo sin 1.º", div: 3, hits: [0, 1, 1] },
  { id: "tres-sin3", name: "Tresillo sin 3.º", div: 3, hits: [1, 1, 0] },
  { id: "semis", name: "Semicorcheas", div: 4, hits: [1, 1, 1, 1] },
  { id: "semis-contra", name: "Semis contratiempo", div: 4, hits: [0, 1, 0, 1] },
  { id: "corchea-2semis", name: "Corchea + 2 semis", div: 4, hits: [1, 0, 1, 1] },
  { id: "2semis-corchea", name: "2 semis + corchea", div: 4, hits: [1, 1, 1, 0] },
  { id: "puntillo-semi", name: "Puntillo + semi", div: 4, hits: [1, 0, 0, 1] },
  { id: "semi-puntillo", name: "Semi + puntillo", div: 4, hits: [1, 1, 0, 0] },
  { id: "quintillo", name: "Quintillo", div: 5, hits: [1, 1, 1, 1, 1] },
  { id: "seisillo", name: "Seisillo", div: 6, hits: [1, 1, 1, 1, 1, 1] },
  { id: "septillo", name: "Septillo", div: 7, hits: [1, 1, 1, 1, 1, 1, 1] },
  { id: "fusas", name: "Fusas", div: 8, hits: [1, 1, 1, 1, 1, 1, 1, 1] },
];
const OLD_SUB = { 1: "negra", 2: "corcheas", 3: "tresillo", 4: "semis" };
const patOf = (id) => PATTERNS.find((p) => p.id === id) || PATTERNS[0];

const COMMON_SIGS = [[2, 4], [3, 4], [4, 4], [5, 4], [7, 4], [3, 8], [5, 8], [6, 8], [7, 8], [9, 8], [11, 8], [12, 8], [2, 2], [3, 2]];
const GROUPS = {
  5: [[3, 2], [2, 3]], 6: [[3, 3], [2, 2, 2]], 7: [[2, 2, 3], [3, 2, 2], [2, 3, 2], [4, 3], [3, 4]],
  8: [[3, 3, 2], [2, 3, 3], [4, 4], [2, 2, 2, 2]], 9: [[3, 3, 3], [2, 2, 2, 3]], 10: [[3, 3, 2, 2], [5, 5], [2, 2, 3, 3]],
  11: [[3, 3, 3, 2], [3, 3, 2, 3], [2, 3, 3, 3]], 12: [[3, 3, 3, 3], [4, 4, 4], [2, 2, 2, 2, 2, 2]],
  13: [[3, 3, 3, 4], [4, 3, 3, 3]], 14: [[3, 3, 4, 4], [2, 2, 2, 2, 2, 2, 2]], 15: [[3, 3, 3, 3, 3], [5, 5, 5]],
  16: [[4, 4, 4, 4], [3, 3, 3, 3, 4]],
};
const groupLevels = (g) => g.flatMap((len, gi) => Array.from({ length: len }, (_, i) => (i === 0 ? (gi === 0 ? 3 : 2) : 1)));
const GAIN = { 3: 1, 2: 0.6, 1: 0.32, sub: 0.3 };

/* ---------- Estado ---------- */
const saved = store.get("metro.state", {});
const state = Object.assign({
  bpm: 62, num: 4, den: 4, pat: "negra", sound: "click", sound2: null, vol: 0.9, timerMin: 30, levels: [3, 2, 2, 2],
  tStart: false, tStop: true, tRepeat: false, polyOn: false, polyN: 3, group: null,
  ciOn: false, ciBars: 1, gapOn: false, gapPlay: 4, gapMute: 2, flashOn: false, voiceOn: false,
}, saved);
if (saved.sub && !saved.pat) state.pat = OLD_SUB[saved.sub] || "negra";
delete state.sub;
state.num = clamp(state.num, 1, 16);
state.levels = normalizeLevels(state.levels, state.num);
state.timerMin = clamp(state.timerMin || 30, 1, 180);
let songs = store.get("metro.songs", []);
const persist = () => store.set("metro.state", state);

function normalizeLevels(lv, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lv && lv[i] !== undefined ? lv[i] : (i === 0 ? 3 : 2));
  return out;
}
const songPat = (s) => s.pat || OLD_SUB[s.sub] || "negra";

/* ---------- Temas ---------- */
const THEMES = [["auto", "Automático"], ["medianoche", "Medianoche"], ["claro", "Claro"], ["grafito", "Grafito"], ["aurora", "Aurora"], ["ambar", "Ámbar"], ["carmesi", "Carmesí"]];
let themeChoice = store.get("metro.theme", "auto");
const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const id = themeChoice === "auto" ? (darkMQ.matches ? "medianoche" : "claro") : themeChoice;
  document.documentElement.dataset.theme = id;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg1").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.content = bg;
  applyCtl();
}
// Control central por defecto de cada tema; el usuario puede fijar otro aparte.
const CTL_BY_THEME = { medianoche: "disco", claro: "regla", grafito: "pend", aurora: "orbe", ambar: "pend", carmesi: "orbe" };
const CTLS = [["tema", "Según el tema"], ["disco", "Disco"], ["pend", "Péndulo"], ["orbe", "Orbe"], ["regla", "Regla"]];
const CTL_NAME = { disco: "Disco", pend: "Péndulo", orbe: "Orbe", regla: "Regla" };
let ctlChoice = store.get("metro.ctl", "regla");
function applyCtl() {
  const id = ctlChoice === "tema" ? (CTL_BY_THEME[document.documentElement.dataset.theme] || "disco") : ctlChoice;
  document.documentElement.dataset.ctl = id;
  requestAnimationFrame(() => { if (id === "regla") drawRuler(); });
}
darkMQ.addEventListener && darkMQ.addEventListener("change", () => { if (themeChoice === "auto") applyTheme(); });

/* ---------- Render ---------- */
const pvHTML = (p) => p.hits.map((h) => `<i class="${h ? "h" : ""}"></i>`).join("");
function tempoName(b) {
  if (b < 40) return "Grave";
  if (b < 60) return "Largo";
  if (b < 76) return "Adagio";
  if (b < 108) return "Andante";
  if (b < 120) return "Moderato";
  if (b < 156) return "Allegro";
  if (b < 176) return "Vivace";
  if (b < 200) return "Presto";
  return "Prestissimo";
}
function renderBpm() {
  $("bpmNum").textContent = state.bpm;
  $("tempoName").textContent = tempoName(state.bpm);
  $("ring").style.transform = `rotate(${(state.bpm * 3) % 360}deg)`;
  $("prog").style.strokeDasharray = `${75 * ((state.bpm - 20) / 280)} 100`;
  $("orbBpm").textContent = state.bpm;
  $("weight").style.bottom = `${((300 - state.bpm) / 280) * 88}%`;
  if (rulerPos === null && document.documentElement.dataset.ctl === "regla") drawRuler();
}
function renderAll() {
  renderBpm();
  const p = patOf(state.pat);
  $("sigTxt").textContent = `${state.num}/${state.den}`;
  $("subVis").innerHTML = pvHTML(p);
  $("subTxt").textContent = p.name;
  $("polyChip").hidden = !state.polyOn;
  $("polyTxt").textContent = `${state.polyN} contra ${state.num}`;
  renderPolyDots();
  renderPads();
  timerRender();
  refreshMore();
}
function renderPolyDots() {
  const box = $("polyDots");
  box.hidden = !state.polyOn;
  box.innerHTML = state.polyOn ? "<i></i>".repeat(state.polyN) : "";
}
function renderPads() {
  const pads = $("pads");
  pads.innerHTML = "";
  state.levels.forEach((lv, i) => {
    const col = document.createElement("div");
    col.className = "col";
    col.dataset.i = i;
    for (let row = 3; row >= 1; row--) {
      const c = document.createElement("button");
      c.className = "cell" + (lv >= row ? " on" : "");
      c.setAttribute("aria-label", `Tiempo ${i + 1}, nivel ${row}`);
      c.addEventListener("click", () => {
        state.levels[i] = state.levels[i] === row ? row - 1 : row;
        state.group = null;
        persist();
        renderPads();
      });
      col.appendChild(c);
    }
    pads.appendChild(col);
  });
  renderOrbDots();
}
function setBpm(v) {
  const n = clamp(Math.round(v), 20, 300);
  if (n === state.bpm) return;
  state.bpm = n;
  renderBpm();
  persist();
}
function setSignature(num, den) {
  state.num = clamp(num, 1, 16);
  state.den = den;
  state.levels = normalizeLevels(state.levels, state.num);
  beatIdx = 0;
  persist();
  renderAll();
}

/* ---------- Audio ---------- */
let ctx = null, master = null, silentEl = null;
let running = false, nextTime = 0, beatIdx = 0, subIdx = 0, timerId = null, visQueue = [], polyQueue = [];
let polyNext = 0, polyIdx = 0;
let barIdx = 0, countLeft = 0, countTotal = 0, halted = false, sessionStart = 0, sessionAcc = 0, barHook = null;

function silentWav() {
  const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let bin = ""; new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return "data:audio/wav;base64," + btoa(bin);
}
function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    // Limitador: permite subir mucho la ganancia sin distorsionar.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.001; comp.release.value = 0.1;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.5;
    master.connect(comp); comp.connect(makeup); makeup.connect(ctx.destination);
  }
  master.gain.value = volGain();
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* no disponible */ }
  if (!silentEl) {
    silentEl = new Audio(silentWav());
    silentEl.loop = true;
    silentEl.setAttribute("playsinline", "");
  }
  silentEl.play().catch(() => {});
  if (ctx.state !== "running") ctx.resume();
}
function tone(time, type, freq, gain, dur, sweepTo) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, time);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, time + dur);
  e.gain.setValueAtTime(0.0001, time);
  e.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.002);
  e.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(e); e.connect(master);
  o.start(time); o.stop(time + dur + 0.02);
}
// El control va de 0 a 1; la ganancia real llega a 3x para que el 100 % suene fuerte.
const volGain = () => state.vol * 3;
let noiseBuf = null;
function noiseBurst(time, gain, dur, ftype, freq, q) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
  s.buffer = noiseBuf; f.type = ftype; f.frequency.value = freq; f.Q.value = q || 1;
  e.gain.setValueAtTime(0.0001, time);
  e.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.002);
  e.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  s.connect(f); f.connect(e); e.connect(master);
  s.start(time); s.stop(time + dur + 0.02);
}
function click(time, level) {
  const idx = level === 3 ? 0 : level === 2 ? 1 : 2;
  // Las subdivisiones usan el timbre secundario si se eligió uno; si no, el principal.
  const id = level === "sub" ? (state.sound2 || state.sound) : state.sound;
  (SOUNDS[id] || SOUNDS.click).play(time, idx, GAIN[level] || 0.4);
}
function polyClick(time, first) {
  tone(time, "sine", first ? 1760 : 1320, first ? 0.55 : 0.38, 0.09);
}
// Silencios periódicos: suena "gapPlay" compases y se calla "gapMute", en ciclo.
const isMuted = () => state.gapOn && barIdx % (state.gapPlay + state.gapMute) >= state.gapPlay;

function scheduler() {
  if (halted) return;
  while (nextTime < ctx.currentTime + 0.12) {
    // Cuenta previa: solo pulsos, sin subdivisiones ni polirritmo.
    if (countLeft > 0) {
      const k = countTotal - countLeft, b = k % state.num;
      click(nextTime, b === 0 ? 3 : 2);
      visQueue.push({ t: nextTime, beat: b, count: k + 1, total: countTotal });
      nextTime += 60 / state.bpm;
      if (--countLeft === 0) { beatIdx = 0; subIdx = 0; barIdx = 0; polyNext = nextTime; polyIdx = 0; }
      continue;
    }
    let p = patOf(state.pat);
    if (beatIdx >= state.num) beatIdx = 0;
    if (subIdx >= p.div) subIdx = 0;
    // Al inicio de cada compás, una práctica por compases puede cambiar tempo, compás o patrón.
    if (subIdx === 0 && beatIdx === 0 && barHook && barHook(barIdx) === false) { halted = true; return; }
    p = patOf(state.pat);
    const step = 60 / state.bpm / p.div, muted = isMuted();
    if (subIdx === 0) {
      const lv = state.levels[beatIdx];
      if (!muted && p.hits[0] && lv > 0) click(nextTime, lv);
      visQueue.push({ t: nextTime, beat: beatIdx, bar: barIdx, muted });
    } else if (!muted && p.hits[subIdx]) {
      click(nextTime, "sub");
    }
    nextTime += step;
    if (++subIdx >= p.div) { subIdx = 0; beatIdx = (beatIdx + 1) % state.num; if (beatIdx === 0) barIdx++; }
  }
  if (state.polyOn && countLeft === 0) {
    const pd = (60 / state.bpm * state.num) / state.polyN;
    while (polyNext < ctx.currentTime + 0.12) {
      if (polyIdx >= state.polyN) polyIdx = 0;
      if (!isMuted()) polyClick(polyNext, polyIdx === 0);
      polyQueue.push({ t: polyNext, i: polyIdx });
      polyNext += pd;
      polyIdx = (polyIdx + 1) % state.polyN;
    }
  }
}
function visLoop() {
  if (!running) return;
  while (visQueue.length && visQueue[0].t <= ctx.currentTime) flashEntry(visQueue.shift());
  while (polyQueue.length && polyQueue[0].t <= ctx.currentTime) flashPoly(polyQueue.shift().i);
  requestAnimationFrame(visLoop);
}
const NUM_WORDS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];
function say(n) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(NUM_WORDS[n] || String(n));
    u.lang = "es-ES"; u.rate = 1.6; u.volume = Math.min(1, state.vol * 1.3);
    speechSynthesis.speak(u);
  } catch { /* sin voz disponible */ }
}
function screenFlash(strength) {
  const el = $("flash");
  el.style.setProperty("--fo", strength);
  el.classList.remove("go");
  void el.offsetWidth;
  el.classList.add("go");
}
function beatUI(i) {
  document.querySelectorAll(".col.beat").forEach((c) => c.classList.remove("beat"));
  const c = document.querySelector(`.col[data-i="${i}"]`);
  if (c) c.classList.add("beat");
  document.querySelectorAll("#orbDots .on").forEach((d) => d.classList.remove("on"));
  const od = $("orbDots").children[i];
  if (od) od.classList.add("on");
  const core = $("orbCore");
  core.classList.add("pulse");
  setTimeout(() => core.classList.remove("pulse"), 90);
  swingPhase = swingBeat++;
}
function flashEntry(e) {
  beatUI(e.beat);
  if (e.count) {
    $("status").textContent = `Cuenta previa ${e.count} de ${e.total}`;
    if (state.flashOn) screenFlash(e.beat === 0 ? 0.5 : 0.28);
    if (state.voiceOn) say(e.beat + 1);
    return;
  }
  if (run) {
    run.curBeat = e.beat;
    if (run.t0 === null && run.unit === "time") run.t0 = performance.now();
  } else if (state.gapOn) {
    $("status").textContent = e.muted ? `En silencio, compás ${e.bar + 1}` : `Sonando, compás ${e.bar + 1}`;
  }
  if (e.muted) return;
  if (state.flashOn) screenFlash(e.beat === 0 ? 0.5 : 0.28);
  if (state.voiceOn) say(e.beat + 1);
}
function setPlayUI(on) {
  document.querySelectorAll(".js-play").forEach((b) => {
    b.classList.toggle("running", on);
    b.innerHTML = `<i class="fa-solid fa-${on ? "pause" : "play"}"></i>`;
  });
  $("orbIco").className = `fa-solid fa-${on ? "pause" : "play"}`;
}
function flashPoly(i) {
  const dots = $("polyDots").children;
  for (const d of dots) d.classList.remove("on");
  if (dots[i]) dots[i].classList.add("on");
}
function start(resume) {
  if (running) return;
  ensureAudio();
  running = true; halted = false;
  beatIdx = 0; subIdx = 0; visQueue = []; polyQueue = []; polyIdx = 0;
  if (resume) countLeft = 0;
  else {
    barIdx = 0; sessionAcc = 0;
    countTotal = state.ciOn ? state.ciBars * state.num : 0;
    countLeft = countTotal;
  }
  nextTime = ctx.currentTime + 0.08;
  polyNext = nextTime;
  sessionStart = performance.now();
  timerId = setInterval(scheduler, 25);
  scheduler();
  swingBeat = 0; swingPhase = 0;
  setPlayUI(true);
  requestAnimationFrame(visLoop);
}
// stop(true) pausa una práctica sin darla por terminada.
function stop(keepRun) {
  if (!running) return;
  running = false;
  clearInterval(timerId);
  sessionAcc += (performance.now() - sessionStart) / 1000;
  if (keepRun !== true) {
    logSession(run ? run.p.name : "Metrónomo libre", sessionAcc);
    barHook = null;
    if (run) { clearInterval(runId); run = null; }
  }
  halted = false; countLeft = 0;
  if (silentEl && !tRunning && !droneOn) silentEl.pause();
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* sin voz */ }
  document.querySelectorAll(".col.beat").forEach((c) => c.classList.remove("beat"));
  document.querySelectorAll("#polyDots .on").forEach((c) => c.classList.remove("on"));
  document.querySelectorAll("#orbDots .on").forEach((c) => c.classList.remove("on"));
  setPlayUI(false);
  if (keepRun !== true) { clearPracticeUI(); idleStatus(); }
}

/* ---------- Dial y botones ---------- */
(function setupDial() {
  const dial = $("dial");
  let last = null, acc = 0, start0 = 0;
  const ang = (e) => {
    const r = dial.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  dial.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    last = ang(e); acc = 0; start0 = state.bpm;
    dial.setPointerCapture(e.pointerId);
  });
  dial.addEventListener("pointermove", (e) => {
    if (last === null) return;
    const a = ang(e);
    let d = a - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    last = a; acc += d;
    setBpm(start0 + acc / 3);
  });
  const end = () => { last = null; };
  dial.addEventListener("pointerup", end);
  dial.addEventListener("pointercancel", end);
})();

function holdRepeat(el, delta) {
  let t1, t2;
  const stopH = () => { clearTimeout(t1); clearInterval(t2); };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setBpm(state.bpm + delta);
    t1 = setTimeout(() => { t2 = setInterval(() => setBpm(state.bpm + delta), 70); }, 400);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.addEventListener(ev, stopH));
}
document.querySelectorAll(".js-minus").forEach((b) => holdRepeat(b, -1));
document.querySelectorAll(".js-plus").forEach((b) => holdRepeat(b, 1));
const togglePlay = () => {
  if (run && run.paused) return resumeRun();
  if (run && running) return pauseRun();
  return running ? stop() : start();
};
document.querySelectorAll(".js-play").forEach((b) => b.addEventListener("click", togglePlay));

let taps = [];
$("tapBtn").addEventListener("click", () => {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  taps = taps.slice(-7);
  if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
});

/* ---------- Hojas de diálogo propias ---------- */
function sheet(title, build, actions) {
  return new Promise((resolve) => {
    $("sheetTitle").textContent = title;
    const body = $("sheetBody");
    body.innerHTML = "";
    const close = (v) => { $("backdrop").hidden = true; resolve(v); };
    build(body, close);
    const act = $("sheetActions");
    act.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.cls) b.className = a.cls;
      b.addEventListener("click", () => close(a.value === undefined ? a.label : a.value));
      act.appendChild(b);
    });
    $("backdrop").onclick = (e) => { if (e.target === $("backdrop")) close(null); };
    $("backdrop").hidden = false;
    $("sheet").scrollTop = 0;
  });
}
const askConfirm = (title, text, okLabel = "Eliminar") =>
  sheet(title, (b) => { b.innerHTML = `<p class="note">${text}</p>`; },
    [{ label: "Cancelar", value: false }, { label: okLabel, cls: "danger", value: true }]);

function h3(text) { const h = document.createElement("h3"); h.textContent = text; return h; }
function stepper(label, get, set, min, max, fmt = (v) => v, step = 1) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label>${label}</label><div class="stepper"><button aria-label="Menos"><i class="fa-solid fa-minus"></i></button><output></output><button aria-label="Más"><i class="fa-solid fa-plus"></i></button></div>`;
  const out = row.querySelector("output");
  const upd = () => (out.textContent = fmt(get()));
  const [m, p] = row.querySelectorAll("button");
  m.onclick = () => { set(clamp(get() - step, min, max)); upd(); };
  p.onclick = () => { set(clamp(get() + step, min, max)); upd(); };
  upd();
  return row;
}
function chips(options, current, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "chips";
  options.forEach(([val, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (val === current) b.className = "sel";
    b.onclick = () => { wrap.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.className = "sel"; onPick(val); };
    wrap.appendChild(b);
  });
  return wrap;
}
function switchRow(label, on, onChange) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label>${label}</label><button class="switch${on ? " on" : ""}" role="switch" aria-checked="${!!on}" aria-label="${label}"></button>`;
  const sw = row.querySelector("button");
  sw.onclick = () => { on = !on; sw.classList.toggle("on", on); sw.setAttribute("aria-checked", on); onChange(on); };
  return row;
}

/* ---------- Compás, pulsos y polirritmo ---------- */
function openSignature() {
  let n = state.num, d = state.den, grp = state.group, pOn = state.polyOn, pN = state.polyN;
  sheet("Compás y pulsos", (b) => {
    const render = () => {
      b.innerHTML = "";
      b.appendChild(stepper("Pulsos por compás", () => n, (v) => { n = v; grp = null; render(); }, 1, 16));
      b.appendChild(h3("Figura del pulso"));
      b.appendChild(chips([[2, "2 (blanca)"], [4, "4 (negra)"], [8, "8 (corchea)"], [16, "16"]], d, (v) => (d = v)));
      b.appendChild(h3("Compases comunes"));
      b.appendChild(chips(COMMON_SIGS.map(([a, c]) => [`${a}/${c}`, `${a}/${c}`]), `${n}/${d}`, (v) => {
        [n, d] = v.split("/").map(Number); grp = null; render();
      }));
      if (GROUPS[n]) {
        b.appendChild(h3("Agrupación de acentos"));
        b.appendChild(chips([["", "Sin agrupar"], ...GROUPS[n].map((g) => [g.join("+"), g.join(" + ")])], grp ? grp.join("+") : "", (v) => {
          grp = v ? v.split("+").map(Number) : null;
        }));
      }
      b.appendChild(h3("Polirritmo"));
      b.appendChild(switchRow("Añadir capa contra el compás", pOn, (v) => { pOn = v; render(); }));
      if (pOn) b.appendChild(stepper("Notas repartidas en el compás", () => pN, (v) => (pN = v), 2, 16));
    };
    render();
  }, [{ label: "Cancelar", value: false }, { label: "Aplicar", cls: "primary", value: true }]).then((ok) => {
    if (!ok) return;
    state.polyOn = pOn; state.polyN = pN;
    setSignature(n, d);
    if (grp && grp.reduce((a, c) => a + c, 0) === n) state.levels = groupLevels(grp);
    state.group = grp;
    if (running) { polyIdx = 0; polyNext = nextTime; }
    persist(); renderAll();
  });
}
function openPatterns() {
  sheet("Subdivisión del pulso", (b) => {
    const g = document.createElement("div");
    g.className = "pgrid";
    PATTERNS.forEach((p) => {
      const c = document.createElement("button");
      c.className = "pcell" + (p.id === state.pat ? " sel" : "");
      c.innerHTML = `<span class="pv">${pvHTML(p)}</span><span>${p.name}</span>`;
      c.onclick = () => {
        state.pat = p.id; persist(); renderAll();
        g.querySelectorAll(".pcell").forEach((x) => x.classList.remove("sel"));
        c.classList.add("sel");
      };
      g.appendChild(c);
    });
    b.appendChild(g);
    b.insertAdjacentHTML("beforeend", '<p class="note">Las barras llenas suenan y las vacías son silencios dentro de cada pulso.</p>');
  }, [{ label: "Listo", cls: "primary", value: true }]);
}
function openTempoInput() {
  let inp;
  sheet("Tempo (BPM)", (b) => {
    inp = document.createElement("input");
    inp.type = "tel"; inp.inputMode = "numeric"; inp.value = state.bpm; inp.maxLength = 3;
    b.appendChild(inp);
    b.insertAdjacentHTML("beforeend", '<p class="note">Entre 20 y 300.</p>');
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  }, [{ label: "Cancelar", value: false }, { label: "Aplicar", cls: "primary", value: true }]).then((ok) => {
    if (ok && inp.value) setBpm(parseInt(inp.value, 10) || state.bpm);
  });
}
$("sigBtn").addEventListener("click", openSignature);
$("polyChip").addEventListener("click", openSignature);
$("subBtn").addEventListener("click", openPatterns);
$("tempoBtn").addEventListener("click", openTempoInput);

/* ---------- Sonido, volumen, pantalla y tema ---------- */
$("btnSound").addEventListener("click", () => {
  // Vista previa que mezcla ambos timbres: pulso, subdivisión, pulso, subdivisión.
  const preview = () => {
    ensureAudio();
    const t = ctx.currentTime + 0.03;
    click(t, 3); click(t + 0.25, "sub"); click(t + 0.5, 2); click(t + 0.75, "sub");
    setTimeout(() => { if (!running && !tRunning && silentEl) silentEl.pause(); }, 1400);
  };
  const names = Object.entries(SOUNDS).map(([k, v]) => [k, v.name]);
  sheet("Sonido", (b) => {
    b.appendChild(h3("Principal (pulsos)"));
    b.appendChild(chips(names, state.sound, (v) => { state.sound = v; persist(); preview(); }));
    b.appendChild(h3("Secundario (subdivisiones)"));
    b.appendChild(chips([["", "Igual al principal"], ...names], state.sound2 || "", (v) => { state.sound2 = v || null; persist(); preview(); }));
    b.insertAdjacentHTML("beforeend", '<p class="note">El secundario suena en las subdivisiones de cada pulso. Elige una subdivisión distinta de Negra para oírlo.</p>');
  }, [{ label: "Listo", cls: "primary", value: true }]);
});
$("btnVol").addEventListener("click", () => {
  sheet("Volumen", (b) => {
    const r = document.createElement("input");
    r.type = "range"; r.min = 0; r.max = 1; r.step = 0.01; r.value = state.vol;
    r.oninput = () => { state.vol = +r.value; if (master) master.gain.value = volGain(); persist(); };
    b.appendChild(r);
  }, [{ label: "Listo", cls: "primary", value: true }]);
});
$("btnTheme").addEventListener("click", () => {
  sheet("Tema", (b) => {
    const g = document.createElement("div");
    g.className = "swgrid";
    THEMES.forEach(([id, name]) => {
      const s = document.createElement("button");
      s.className = "swatch" + (id === "auto" ? " auto" : "") + (id === themeChoice ? " sel" : "");
      if (id !== "auto") s.dataset.theme = id;
      const ctlFor = id === "auto" ? "Sistema" : CTL_NAME[CTL_BY_THEME[id]];
      s.innerHTML = `<span>${name}</span><small>${ctlFor}</small>`;
      s.onclick = () => {
        themeChoice = id; store.set("metro.theme", id); applyTheme();
        g.querySelectorAll(".swatch").forEach((x) => x.classList.remove("sel"));
        s.classList.add("sel");
      };
      g.appendChild(s);
    });
    b.appendChild(g);
    b.appendChild(h3("Control central"));
    b.appendChild(chips(CTLS, ctlChoice, (v) => { ctlChoice = v; store.set("metro.ctl", v); applyCtl(); }));
    b.insertAdjacentHTML("beforeend", '<p class="note">"Según el tema" usa el control propio de cada tema; los demás lo fijan para todos.</p>');
    b.insertAdjacentHTML("beforeend",
      '<div class="credit"><span>Desarrollado por</span><img class="logo-dark" src="img/lpsolutions-blanco.webp" alt="LPSOLUTIONS"><img class="logo-light" src="img/lpsolutions-negro.webp" alt="LPSOLUTIONS"></div>');
  }, [{ label: "Listo", cls: "primary", value: true }]);
});

/* ---------- Temporizador ---------- */
let tRunning = false, tPaused = false, tEnd = 0, tLeft = 0, tId = null;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const timerSecs = () => (tPaused ? Math.ceil(tLeft / 1000) : Math.max(0, Math.ceil((tEnd - performance.now()) / 1000)));

function chime() {
  if (!ctx) return;
  [0, 0.2, 0.4].forEach((d) => tone(ctx.currentTime + 0.05 + d, "sine", 1320, 0.5, 0.16));
}
function timerRender() {
  const b = $("btnTimer");
  if (tRunning) {
    b.innerHTML = `<span class="tlabel">${fmtTime(timerSecs())}</span>`;
    b.classList.add("active");
  } else {
    b.innerHTML = '<i class="fa-solid fa-stopwatch"></i>';
    b.classList.remove("active");
  }
  const lcd = $("timerLcd");
  if (lcd) lcd.textContent = fmtTime(tRunning ? timerSecs() : state.timerMin * 60);
  // Cuenta regresiva general: se ve en la tarjeta principal con cualquier tema o control.
  const pill = $("tpill");
  if (pill) {
    pill.hidden = !tRunning || !!(typeof run !== "undefined" && run);
    if (tRunning) {
      pill.querySelector("b").textContent = fmtTime(timerSecs());
      pill.querySelector("small").textContent = tPaused ? "En pausa" : "Restante";
    }
    if (typeof syncHeroPill === "function") syncHeroPill();
  }
}
function timerTick() {
  if (!tRunning || tPaused) return;
  if (timerSecs() <= 0) timerFinish(); else timerRender();
}
function timerStart() {
  ensureAudio();
  tRunning = true; tPaused = false;
  tEnd = performance.now() + state.timerMin * 60000;
  if (state.tStart && !running) start();
  clearInterval(tId);
  tId = setInterval(timerTick, 250);
  timerRender();
}
function timerStop() {
  clearInterval(tId);
  tRunning = false; tPaused = false;
  if (!running && silentEl) silentEl.pause();
  timerRender();
}
function timerFinish() {
  chime();
  if (state.tStop && running) stop();
  if (state.tRepeat) {
    tEnd = performance.now() + state.timerMin * 60000;
    if (state.tStart && !running) start();
    timerRender();
  } else timerStop();
}
function timerSheet() {
  const renderCtl = () => {
    const ctl = $("tCtl"), dur = $("tDur");
    if (!ctl) return;
    ctl.innerHTML = "";
    const add = (label, cls, fn) => {
      const b = document.createElement("button");
      b.textContent = label; b.className = cls; b.onclick = () => { fn(); renderCtl(); timerRender(); };
      ctl.appendChild(b);
    };
    if (!tRunning) add("Iniciar", "pill go", timerStart);
    else {
      add(tPaused ? "Reanudar" : "Pausar", "pill go", () => {
        if (tPaused) { tEnd = performance.now() + tLeft; tPaused = false; }
        else { tLeft = Math.max(0, tEnd - performance.now()); tPaused = true; }
      });
      add("Detener", "pill stop", timerStop);
    }
    dur.hidden = tRunning;
  };
  sheet("Temporizador", (b) => {
    b.innerHTML = '<div class="timer-lcd" id="timerLcd"></div><div class="ctl-row" id="tCtl"></div><div id="tDur"></div><div id="tOpts"></div>';
    $("tDur").appendChild(stepper("Duración (min)", () => state.timerMin, (v) => { state.timerMin = v; persist(); timerRender(); }, 1, 180));
    [["tStart", "Iniciar metrónomo simultáneamente"], ["tStop", "Detener el metrónomo cuando el temporizador termine"], ["tRepeat", "Temporizador repetido"]]
      .forEach(([k, label]) => $("tOpts").appendChild(switchRow(label, state[k], (v) => { state[k] = v; persist(); })));
    renderCtl(); timerRender();
  }, [{ label: "Cerrar", cls: "primary", value: true }]);
}
$("btnTimer").addEventListener("click", timerSheet);

/* ---------- Pestañas y repertorio ---------- */
document.querySelectorAll(".tab[data-view]").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === t.dataset.view));
}));
function showView(id) { document.querySelector(`.tab[data-view="${id}"]`).click(); }

// Menú de acciones: una lista de botones; resuelve con el valor del elegido.
function menuSheet(title, items) {
  return sheet(title, (b, close) => {
    const list = document.createElement("div");
    list.className = "menu";
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.className = "menu-btn" + (it.danger ? " danger" : "");
      btn.innerHTML = `<i class="fa-solid fa-${it.icon}"></i><span></span>`;
      btn.querySelector("span").textContent = it.label;
      btn.onclick = () => close(it.value);
      list.appendChild(btn);
    });
    b.appendChild(list);
  }, [{ label: "Cerrar", value: null }]);
}
function askText(title, placeholder, value = "") {
  let inp;
  return sheet(title, (b) => {
    inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = placeholder; inp.maxLength = 40; inp.value = value;
    b.appendChild(inp);
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  }, [{ label: "Cancelar", value: false }, { label: "Guardar", cls: "primary", value: true }]).then((ok) => (ok ? inp.value.trim() : null));
}

songs.forEach((s, i) => { if (!s.id) s.id = Date.now() + i; });
let currentSong = null;
const songIdx = () => songs.findIndex((s) => s.id === currentSong);
const saveSongs = () => store.set("metro.songs", songs);

function loadSong(s) {
  Object.assign(state, {
    bpm: s.bpm, num: s.num, den: s.den, pat: songPat(s), levels: normalizeLevels(s.levels, s.num),
    polyOn: !!s.polyOn, polyN: s.polyN || 3, group: null,
    ...(s.sound && SOUNDS[s.sound] ? { sound: s.sound, sound2: SOUNDS[s.sound2] ? s.sound2 : null } : {}),
  });
  currentSong = s.id;
  persist(); renderAll(); renderSongBar();
}
function renderSongBar() {
  const bar = $("songBar"), i = songIdx();
  bar.hidden = i < 0;
  if (i < 0) return;
  $("songBarName").textContent = songs[i].name;
  $("songBarPos").textContent = `${i + 1} de ${songs.length}`;
  $("songPrev").disabled = i === 0;
  $("songNext").disabled = i === songs.length - 1;
}
$("songPrev").onclick = () => { const i = songIdx(); if (i > 0) loadSong(songs[i - 1]); };
$("songNext").onclick = () => { const i = songIdx(); if (i >= 0 && i < songs.length - 1) loadSong(songs[i + 1]); };
$("songClose").onclick = () => { currentSong = null; renderSongBar(); };

function songSnapshot() {
  return { bpm: state.bpm, num: state.num, den: state.den, pat: state.pat, levels: [...state.levels], polyOn: state.polyOn, polyN: state.polyN, sound: state.sound, sound2: state.sound2 };
}
function renderSongs() {
  const ul = $("songList");
  ul.innerHTML = "";
  $("songEmpty").hidden = songs.length > 0;
  songs.forEach((s) => {
    const li = document.createElement("li");
    const secs = s.sections && s.sections.length;
    li.innerHTML = `<button class="info"><div class="nm"></div><div class="meta"></div></button>${secs ? '<button class="splay" aria-label="Reproducir secciones"><i class="fa-solid fa-play"></i></button>' : ""}<button class="del" aria-label="Opciones"><i class="fa-solid fa-ellipsis"></i></button>`;
    li.querySelector(".nm").textContent = s.name;
    li.querySelector(".meta").textContent = `${s.bpm} BPM, ${s.num}/${s.den}, ${patOf(songPat(s)).name}${s.polyOn ? `, poli ${s.polyN}:${s.num}` : ""}${secs ? `, ${s.sections.length} secciones` : ""}`;
    li.querySelector(".info").onclick = () => { loadSong(s); showView("viewMetro"); };
    if (secs) li.querySelector(".splay").onclick = () => startSong(s);
    li.querySelector(".del").onclick = () => songMenu(s);
    ul.appendChild(li);
  });
}
async function songMenu(s) {
  const i = songs.indexOf(s);
  const items = [{ icon: "folder-open", label: "Cargar", value: "load" }];
  if (s.sections && s.sections.length) items.push({ icon: "play", label: "Reproducir con secciones", value: "play" });
  items.push({ icon: "list-ol", label: "Editar secciones", value: "sections" },
    { icon: "arrows-rotate", label: "Actualizar con los ajustes actuales", value: "update" },
    { icon: "pen", label: "Renombrar", value: "rename" });
  if (i > 0) items.push({ icon: "arrow-up", label: "Subir en la lista", value: "up" });
  if (i < songs.length - 1) items.push({ icon: "arrow-down", label: "Bajar en la lista", value: "down" });
  items.push({ icon: "trash", label: "Eliminar", value: "del", danger: true });
  const r = await menuSheet(s.name, items);
  if (r === "load") { loadSong(s); showView("viewMetro"); }
  else if (r === "play") startSong(s);
  else if (r === "sections") editSections(s);
  else if (r === "update") { Object.assign(s, songSnapshot()); saveSongs(); renderSongs(); }
  else if (r === "rename") { const n = await askText("Renombrar", "Nombre de la pieza", s.name); if (n) { s.name = n; saveSongs(); renderSongs(); renderSongBar(); } }
  else if (r === "up" || r === "down") { songs.splice(i, 1); songs.splice(i + (r === "up" ? -1 : 1), 0, s); saveSongs(); renderSongs(); renderSongBar(); }
  else if (r === "del" && (await askConfirm("Eliminar ajuste", `Se eliminará "${s.name.replace(/</g, "&lt;")}" del repertorio.`))) {
    songs.splice(i, 1); if (currentSong === s.id) currentSong = null;
    saveSongs(); renderSongs(); renderSongBar();
  }
}
$("saveCur").addEventListener("click", async () => {
  const name = await askText("Guardar ajuste", "Nombre de la pieza");
  if (!name) return;
  songs.unshift({ id: Date.now(), name, ...songSnapshot() });
  saveSongs(); renderSongs();
});

/* Secciones de una canción: cada una cambia tempo, compás y patrón durante N compases. */
const compileSections = (secs) => secs.map((m) => ({ from: m.bpm, to: m.bpm, len: clamp(m.bars, 1, 999), meta: m }));
function applySection(m) {
  const [n, d] = String(m.sig || "4/4").split("/").map(Number);
  state.num = clamp(n || 4, 1, 16); state.den = d || 4;
  state.levels = normalizeLevels(state.levels, state.num);
  state.pat = PATTERNS.some((p) => p.id === m.pat) ? m.pat : "negra";
  renderAll();
}
function editSections(s) {
  const secs = JSON.parse(JSON.stringify(s.sections && s.sections.length ? s.sections
    : [{ name: "Sección 1", bars: 8, bpm: s.bpm, sig: `${s.num}/${s.den}`, pat: songPat(s) }]));
  let list, gbox;
  const redrawGraph = () => {
    const segs = compileSections(secs);
    gbox.innerHTML = graphSVG(segs, { h: 130, unit: "bars" }) + `<p class="note">Total ${planTotal(segs)} compases, ${secs.length} secciones</p>`;
  };
  const sigOptions = (cur) => [...new Set([cur, ...COMMON_SIGS.map(([a, c]) => `${a}/${c}`)])];
  const renderList = () => {
    list.innerHTML = "";
    secs.forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "iv";
      row.innerHTML = `<div class="iv-top"><span class="iv-n">${i + 1}</span><input class="sec-name" type="text" maxlength="30" placeholder="Nombre de la sección"></div>
        <div class="iv-top sec-mid">
          <div class="iv-f"><label>BPM</label><div class="mst"><button data-a="bm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><input class="iv-in" data-k="bpm" type="tel" inputmode="numeric" maxlength="3" value="${m.bpm}"><button data-a="bp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>
          <div class="iv-f"><label>Compases</label><div class="mst"><button data-a="rm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><input class="iv-in" data-k="bars" type="tel" inputmode="numeric" maxlength="3" value="${m.bars}"><button data-a="rp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>
        </div>
        <div class="iv-top sec-mid">
          <div class="iv-f"><label>Compás</label><select class="dd" data-k="sig">${sigOptions(m.sig).map((x) => `<option${x === m.sig ? " selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="iv-f"><label>Subdivisión</label><select class="dd" data-k="pat">${PATTERNS.map((p) => `<option value="${p.id}"${p.id === m.pat ? " selected" : ""}>${p.name}</option>`).join("")}</select></div>
        </div>
        <div class="iv-bot"><button data-a="dup"><i class="fa-solid fa-copy"></i> Duplicar</button><button data-a="del"${secs.length === 1 ? " disabled" : ""}><i class="fa-solid fa-trash"></i> Quitar</button></div>`;
      const nm = row.querySelector(".sec-name");
      nm.value = m.name || "";
      nm.addEventListener("input", () => { m.name = nm.value; });
      row.querySelectorAll("input.iv-in").forEach((inp) => {
        const k = inp.dataset.k, lo = k === "bpm" ? 20 : 1, hi = k === "bpm" ? 300 : 999;
        inp.addEventListener("input", () => { const v = parseInt(inp.value, 10); if (v >= lo && v <= hi) { m[k] = v; redrawGraph(); } });
        inp.addEventListener("change", () => { m[k] = clamp(parseInt(inp.value, 10) || m[k], lo, hi); inp.value = m[k]; redrawGraph(); });
      });
      row.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => { m[sel.dataset.k] = sel.value; }));
      row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        const a = b.dataset.a, q = (k) => row.querySelector(`[data-k="${k}"]`);
        if (a === "bm" || a === "bp") { m.bpm = clamp(m.bpm + (a === "bp" ? 5 : -5), 20, 300); q("bpm").value = m.bpm; redrawGraph(); }
        else if (a === "rm" || a === "rp") { m.bars = clamp(m.bars + (a === "rp" ? 1 : -1), 1, 999); q("bars").value = m.bars; redrawGraph(); }
        else if (a === "dup") { secs.splice(i + 1, 0, { ...m, name: m.name ? m.name + " (copia)" : "" }); renderList(); }
        else if (a === "del" && secs.length > 1) { secs.splice(i, 1); renderList(); }
      }));
      list.appendChild(row);
    });
    const add = document.createElement("button");
    add.className = "btn-wide"; add.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir sección';
    add.disabled = secs.length >= 30;
    add.onclick = () => { const l = secs[secs.length - 1]; secs.push({ ...l, name: `Sección ${secs.length + 1}` }); renderList(); };
    list.appendChild(add);
    redrawGraph();
  };
  sheet(`Secciones: ${s.name}`, (b) => {
    gbox = document.createElement("div"); gbox.className = "pgraph-edit";
    list = document.createElement("div");
    b.append(gbox, list);
    b.insertAdjacentHTML("beforeend", '<p class="note">Al reproducir, cada sección dura sus compases y aplica su tempo, compás y subdivisión.</p>');
    renderList();
  }, [{ label: "Cancelar", value: false }, { label: "Guardar", cls: "primary", value: true }]).then((ok) => {
    if (!ok) return;
    secs.forEach((m, i) => { if (!m.name || !m.name.trim()) m.name = `Sección ${i + 1}`; });
    s.sections = secs; saveSongs(); renderSongs();
  });
}
function startSong(s) {
  if (!s.sections || !s.sections.length) return;
  loadSong(s);
  lastRun = { kind: "song", id: s.id }; store.set("metro.lastRun", lastRun);
  startRun({ name: s.name, id: "song" + s.id }, compileSections(s.sections), "bars");
}

/* ---------- Copia de seguridad (archivo local) ---------- */
const BACKUP_KEYS = ["metro.state", "metro.songs", "metro.practices", "metro.log", "metro.theme", "metro.ctl", "metro.lastRun"];
async function exportData() {
  const data = {};
  BACKUP_KEYS.forEach((k) => { const v = store.get(k, undefined); if (v !== undefined) data[k] = v; });
  const text = JSON.stringify({ app: "lpsolutions-metronomo", v: 1, saved: new Date().toISOString(), data }, null, 2);
  const name = `metronomo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], name, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Respaldo del metrónomo" }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importData() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { obj = null; }
    if (!obj || obj.app !== "lpsolutions-metronomo" || typeof obj.data !== "object") {
      await sheet("Archivo no válido", (b) => { b.innerHTML = '<p class="note">Este archivo no es un respaldo del metrónomo.</p>'; }, [{ label: "Entendido", cls: "primary", value: true }]);
      return;
    }
    const ok = await askConfirm("Restaurar respaldo", "Se reemplazarán tus ajustes, repertorio, prácticas e historial actuales por los del archivo.", "Restaurar");
    if (!ok) return;
    BACKUP_KEYS.forEach((k) => { if (k in obj.data) store.set(k, obj.data[k]); });
    location.reload();
  };
  inp.click();
}
$("btnExport").addEventListener("click", exportData);
$("btnImport").addEventListener("click", importData);

/* ---------- Registro de sesiones ---------- */
let sessionLog = store.get("metro.log", []);
function logSession(name, sec) {
  if (!(sec >= 20)) return;
  sessionLog.push({ ts: Date.now(), name, sec: Math.round(sec), bpm: state.bpm });
  if (sessionLog.length > 300) sessionLog = sessionLog.slice(-300);
  store.set("metro.log", sessionLog);
  renderLog();
}
function renderLog() {
  const box = $("logBox");
  if (!box) return;
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const weekStart = day.getTime() - ((day.getDay() + 6) % 7) * 86400000;
  const sum = (from) => sessionLog.filter((e) => e.ts >= from).reduce((a, e) => a + e.sec, 0);
  const mins = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`);
  const recent = sessionLog.slice(-8).reverse();
  box.innerHTML = `<h3>Historial</h3>
    <div class="stats"><div><b>${mins(sum(day.getTime()))}</b><span>Hoy</span></div><div><b>${mins(sum(weekStart))}</b><span>Esta semana</span></div><div><b>${sessionLog.length}</b><span>Sesiones</span></div></div>
    <ul class="logl">${recent.map((e) => `<li><span class="ln"></span><span class="lm">${new Date(e.ts).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}, ${e.sec >= 60 ? `${Math.floor(e.sec / 60)} min${e.sec % 60 ? ` ${e.sec % 60} s` : ""}` : `${e.sec} s`}</span></li>`).join("")}</ul>
    ${sessionLog.length ? '<button class="btn-wide" id="clearLog"><i class="fa-solid fa-trash"></i> Borrar historial</button>' : '<p class="empty">Aún no hay sesiones. Se guardan las de 20 segundos o más.</p>'}`;
  box.querySelectorAll(".logl li").forEach((li, i) => { li.querySelector(".ln").textContent = recent[i].name; });
  const clr = $("clearLog");
  if (clr) clr.onclick = async () => {
    if (await askConfirm("Borrar historial", "Se eliminarán todas las sesiones registradas.", "Borrar")) { sessionLog = []; store.set("metro.log", sessionLog); renderLog(); }
  };
}

/* ---------- Modo de práctica ---------- */
let practices = store.get("metro.practices", null);
if (!practices) {
  practices = [
    { id: 1, name: "Práctica de velocidad fija", type: "fija", from: 80, to: 120, steps: 4, min: 1, last: 0 },
    { id: 2, name: "Práctica de velocidad progresiva", type: "progresiva", from: 75, to: 150, steps: 6, min: 6, last: 0 },
    { id: 3, name: "Intervalos 120, 100, 140", type: "custom", unit: "time", last: 0,
      intervals: [{ bpm: 120, sec: 60, bars: 8, mode: "salto" }, { bpm: 100, sec: 60, bars: 8, mode: "salto" }, { bpm: 140, sec: 60, bars: 8, mode: "gradual", trans: 15, transBars: 2 }] },
  ];
  store.set("metro.practices", practices);
}
const savePractices = () => store.set("metro.practices", practices);
const fmtLen = (unit, v) => (unit === "bars" ? `${Math.round(v)} comp.` : fmtTime(Math.round(v)));
const unitOf = (p) => (p.type === "custom" && p.unit === "bars" ? "bars" : "time");

// Toda práctica se reduce a tramos {from, to, len}: constante si from == to, gradual si no.
// len son segundos o compases según la unidad. Cada intervalo personalizado puede cambiar
// "de golpe" al entrar, o "gradual": el tempo viaja desde el anterior durante la transición
// y luego se mantiene.
function compileSegs(p) {
  if (p.type === "custom") {
    const iv = p.intervals || [], bars = p.unit === "bars";
    return iv.flatMap((x, i) => {
      const len = Math.max(1, bars ? x.bars || 4 : x.sec);
      const mode = x.mode || (x.ramp ? "gradual" : "salto"), tag = { iv: i + 1, n: iv.length };
      if (i === 0 || mode !== "gradual") return [{ from: x.bpm, to: x.bpm, len, pin: true, ...tag }];
      const legacy = !x.mode && x.ramp;
      const t = clamp(bars ? (x.transBars ?? (legacy ? len : Math.min(2, len))) : (x.trans ?? (legacy ? len : Math.min(10, len))), 1, len);
      const out = [{ from: iv[i - 1].bpm, to: x.bpm, len: t, pin: t >= len, ...tag }];
      if (len - t > 0) out.push({ from: x.bpm, to: x.bpm, len: len - t, pin: true, ...tag });
      return out;
    });
  }
  if (p.type === "fija") {
    return Array.from({ length: p.steps }, (_, i) => {
      const b = Math.round(p.from + ((p.to - p.from) * i) / Math.max(1, p.steps - 1));
      return { from: b, to: b, len: p.min * 60, pin: true, iv: i + 1, n: p.steps };
    });
  }
  return [{ from: p.from, to: p.to, len: p.min * 60, pin: true }];
}
const planTotal = (segs) => segs.reduce((a, s) => a + s.len, 0);
function planAt(segs, el) {
  let t = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (el < t + s.len || i === segs.length - 1) {
      const f = s.len ? clamp((el - t) / s.len, 0, 1) : 1;
      return { bpm: Math.round(s.from + (s.to - s.from) * f), idx: i + 1, count: segs.length };
    }
    t += s.len;
  }
  return { bpm: state.bpm, idx: 0, count: 0 };
}
function practiceMeta(p) {
  const segs = compileSegs(p), all = segs.flatMap((s) => [s.from, s.to]), unit = unitOf(p);
  const lo = Math.min(...all), hi = Math.max(...all), tot = fmtLen(unit, planTotal(segs));
  if (p.type === "custom") { const n = p.intervals.length; return `${n} ${n === 1 ? "intervalo" : "intervalos"}, ${lo} - ${hi} BPM, ${tot}`; }
  if (p.type === "fija") return `${p.from} - ${p.to} BPM, ${p.steps} pasos de ${p.min} min`;
  return `${p.from} - ${p.to} BPM, ${p.min} min en total`;
}

/* Gráfico de curva del tempo */
let graphN = 0;
function graphSVG(segs, { h = 120, labels = true, axis = true, unit = "time" } = {}) {
  const W = 320, L = axis ? 30 : 6, R = 8, T = labels ? 26 : 8, B = axis ? 18 : 6;
  const total = planTotal(segs) || 1;
  const vals = segs.flatMap((s) => [s.from, s.to]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 20) { const m = (hi + lo) / 2; lo = m - 10; hi = m + 10; }
  const pad = (hi - lo) * 0.18; lo -= pad; hi += pad;
  const X = (t) => L + ((W - L - R) * t) / total;
  const Y = (b) => T + (h - T - B) * (1 - (b - lo) / (hi - lo));
  const raw = (t) => {
    let a = 0;
    for (const s of segs) { if (t <= a + s.len) return s.from + (s.to - s.from) * (s.len ? (t - a) / s.len : 1); a += s.len; }
    return segs[segs.length - 1].to;
  };
  // Se suavizan las transiciones para que la línea se lea como una curva.
  const wd = Math.min(total * 0.06, unit === "bars" ? total * 0.06 : 10), n = 200, taps = 16, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (total * i) / n;
    let sum = 0, wsum = 0;
    for (let k = -taps; k <= taps; k++) {
      const wgt = 1 - Math.abs(k) / (taps + 1);
      sum += wgt * raw(clamp(t + (wd * k) / taps, 0, total)); wsum += wgt;
    }
    pts.push([X(t), Y(sum / wsum)]);
  }
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const id = ++graphN, base = h - B;
  let s = `<svg class="g" viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Curva de tempo">` +
    `<defs><linearGradient id="lg${id}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--accent2)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>` +
    `<linearGradient id="ag${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>`;
  if (axis) {
    const top = Math.round(hi - pad), bot = Math.round(lo + pad), mid = Math.round((top + bot) / 2);
    [top, mid, bot].forEach((v) => { s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`; });
    s += `<text x="${L}" y="${h - 4}" text-anchor="start">${unit === "bars" ? "1" : "0:00"}</text><text x="${W - R}" y="${h - 4}" text-anchor="end">${fmtLen(unit, total)}</text>`;
  }
  s += `<path d="${d} L${X(total).toFixed(1)} ${base} L${L} ${base} Z" fill="url(#ag${id})"/>` +
    `<path d="${d}" fill="none" stroke="url(#lg${id})" stroke-width="${axis ? 3.2 : 4.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (labels) {
    let a = 0;
    const step = segs.length > 14 ? 3 : segs.length > 8 ? 2 : 1;
    let shown = 0;
    segs.forEach((sg) => {
      const tm = a + sg.len / 2; a += sg.len;
      if (sg.pin === false) return;
      const x = X(tm), y = Y(raw(tm)), i = shown++;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="pin"/>`;
      if (i % step === 0) s += `<text class="lbl" x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="middle">${Math.round(sg.to)}</text>`;
    });
  }
  s += `<line class="gcur" x1="${L}" x2="${L}" y1="${T - 6}" y2="${base}" data-l="${L}" data-w="${W - L - R}" style="opacity:0"/></svg>`;
  return s;
}
function setCursor(root, frac) {
  if (!root) return;
  const c = root.querySelector(".gcur");
  if (!c) return;
  const x = +c.dataset.l + +c.dataset.w * clamp(frac, 0, 1);
  c.setAttribute("x1", x); c.setAttribute("x2", x);
  c.style.opacity = 1;
}

/* Ejecución de una práctica o de una canción con secciones */
let run = null, runId = null, runDone = null;
let lastRun = store.get("metro.lastRun", null);
const lastRunItem = () => {
  if (!lastRun) return null;
  return lastRun.kind === "song" ? songs.find((x) => x.id === lastRun.id) : practices.find((x) => x.id === lastRun.id);
};
function startPractice(p) {
  lastRun = { kind: "practice", id: p.id }; store.set("metro.lastRun", lastRun);
  startRun(p, compileSegs(p), unitOf(p));
}
function startLast() {
  const it = lastRunItem();
  if (!it) return;
  if (lastRun.kind === "song") startSong(it); else startPractice(it);
}
function startRun(p, segs, unit) {
  if (running) stop();
  if (run) endRun();
  runDone = null;
  showView("viewMetro");
  run = { p, segs, unit, total: planTotal(segs), t0: unit === "time" && !state.ciOn ? performance.now() : null, idx: null, bar: 0, curBeat: 0, endAt: 0, lastIdx: 0, paused: false, pauseT: 0 };
  barHook = unit === "bars" ? runBarHook : null;
  if (unit === "time") setBpm(planAt(segs, 0).bpm);
  $("rgSvg").innerHTML = graphSVG(segs, { h: 64, labels: true, axis: false, unit });
  $("rcInt").textContent = "--"; $("rcTot").textContent = "--"; $("rcIntSub").textContent = ""; $("rcTotSub").textContent = ""; $("rcBar").style.width = "0%";
  start();
  renderRunCtl();
  practiceTick();
  runId = setInterval(practiceTick, 120);
}
// Se ejecuta al inicio de cada compás dentro del programador de audio.
function runBarHook(bar) {
  if (!run || run.unit !== "bars") return true;
  if (bar >= run.total) { run.endAt = nextTime; return false; }
  const { bpm, idx } = planAt(run.segs, bar);
  if (state.bpm !== bpm) { state.bpm = bpm; renderBpm(); }
  if (run.lastIdx !== idx) { run.lastIdx = idx; const seg = run.segs[idx - 1]; if (seg && seg.meta) applySection(seg.meta); }
  run.bar = bar; run.idx = idx;
  return true;
}
function finishRun() {
  const desc = { p: run.p, segs: run.segs, unit: run.unit };
  run.p.last = Date.now(); savePractices(); renderPractices();
  chime(); stop();
  runDone = desc;
  setCursor($("runGraph"), 1);
  $("rcIntLbl").textContent = "Completada"; $("rcInt").textContent = "0:00"; $("rcIntSub").textContent = ""; $("rcTot").textContent = "0:00"; $("rcBar").style.width = "100%";
  $("rcIntBox").classList.remove("soon", "urgent");
  renderRunCtl();
  $("status").textContent = "Práctica completada";
}
// Pausar conserva la práctica: el tiempo y el compás actual quedan donde estaban.
function pauseRun() {
  if (!run || !running || run.paused) return;
  run.paused = true; run.pauseT = performance.now();
  stop(true);
  $("status").textContent = "En pausa";
  renderRunCtl();
}
function resumeRun() {
  if (!run || !run.paused) return;
  run.paused = false;
  if (run.unit === "time") { if (run.t0 === null) run.t0 = performance.now(); else run.t0 += performance.now() - run.pauseT; }
  start(true);
  renderRunCtl();
  practiceTick();
}
// Terminar: cierra la práctica (activa o en pausa) y registra la sesión.
function endRun() {
  if (!run) return;
  if (running) { stop(); return; }
  logSession(run.p.name, sessionAcc);
  clearInterval(runId); run = null; barHook = null;
  renderRunCtl(); idleStatus();
}
function trendOf(segs, el) {
  const { idx } = planAt(segs, el), s = segs[idx - 1], nx = segs[idx];
  if (s.to > s.from) return { dir: 1, target: s.to };
  if (s.to < s.from) return { dir: -1, target: s.to };
  return { dir: 0, target: s.to, next: nx && nx.to !== s.to ? nx.to : null };
}
// Indicador de subida o bajada del tempo, visible mientras corre una práctica.
function updateTrend(t) {
  const el = $("trend"), num = $("bpmNum");
  num.classList.remove("up", "down");
  if (!run) { el.hidden = true; syncHeroPill(); return; }
  if (run.paused) { setTrend(el, "hold", "pause", "En pausa", `${state.bpm} BPM`); return; }
  if (!t) { el.hidden = true; syncHeroPill(); return; }
  if (t.dir > 0) { setTrend(el, "up", "angles-up", "Subiendo", `hacia ${t.target} BPM`); num.classList.add("up"); }
  else if (t.dir < 0) { setTrend(el, "down", "angles-down", "Bajando", `hacia ${t.target} BPM`); num.classList.add("down"); }
  else setTrend(el, "hold", "equals", "Estable", t.next ? `luego ${t.next} BPM` : `en ${t.target} BPM`);
}
function syncHeroPill() {
  const t = $("trend"), p = $("tpill");
  document.querySelector(".hero").classList.toggle("withpill", !!((t && !t.hidden) || (p && !p.hidden)));
}
function setTrend(el, cls, icon, title, sub) {
  el.hidden = false;
  el.className = `trend ${cls}`;
  el.querySelector("i").className = `fa-solid fa-${icon}`;
  el.querySelector("b").textContent = title;
  el.querySelector("small").textContent = sub;
  syncHeroPill();
}
// Datos del tramo actual: cuánto queda del tramo y del intervalo, y si es el último.
function countdownInfo(segs, el) {
  let t = 0;
  for (let i = 0; i < segs.length; i++) {
    const end = t + segs[i].len;
    if (el < end || i === segs.length - 1) {
      let ivEnd = end, j = i;
      while (segs[i].iv && j + 1 < segs.length && segs[j + 1].iv === segs[i].iv) { ivEnd += segs[j + 1].len; j++; }
      return { seg: segs[i], i, left: Math.max(0, end - el), ivLeft: Math.max(0, ivEnd - el), isLast: i === segs.length - 1 };
    }
    t = end;
  }
  return null;
}
const fmtCount = (sec) => fmtTime(Math.max(0, Math.ceil(sec - 1e-6)));
// El tiempo que queda del intervalo y del total siempre se ven. Los últimos 10 s antes de un
// cambio (o del final) se destacan con una cuenta grande; fuera de esa ventana el aviso es discreto.
const COUNT_WINDOW = 10.4;
function updateCountdown(el) {
  const { segs, total, unit, p } = run, ci = countdownInfo(segs, el);
  if (!ci) return;
  const s = ci.seg, nx = segs[ci.i + 1], hold = s.from === s.to, bars = unit === "bars";
  const toSec = (v) => (bars ? (v * state.num * 60) / Math.max(20, state.bpm) : v);
  const inWindow = toSec(ci.left) <= COUNT_WINDOW && (hold || ci.isLast);
  const beatsLeft = Math.max(1, Math.round(ci.left * state.num));
  const name = s.meta && s.meta.name ? s.meta.name : s.iv ? `Intervalo ${s.iv}/${s.n}` : segs.length > 1 ? `Tramo ${ci.i + 1}/${segs.length}` : "Gradual";
  const sig = ci.isLast ? "Último tramo" : hold ? (nx.to > s.to ? `Después: subir a ${nx.to} BPM` : nx.to < s.to ? `Después: bajar a ${nx.to} BPM` : `Después: seguir en ${nx.to} BPM`) : `Llegando a ${s.to} BPM`;
  let lbl, val, sub, soon = false;
  if (inWindow) {
    soon = true;
    val = String(bars ? beatsLeft : Math.max(1, Math.ceil(ci.left - 1e-6)));
    lbl = ci.isLast ? "Termina en" : nx.from !== nx.to ? (nx.to > s.to ? "Empezamos a subir en" : "Empezamos a bajar en") : `Cambia a ${nx.to} BPM en`;
    sub = bars ? "tiempos" : "segundos";
  } else {
    lbl = name;
    val = bars ? `${Math.max(1, Math.ceil(ci.ivLeft - 1e-6))} comp.` : fmtCount(ci.ivLeft);
    sub = sig;
  }
  const num = $("rcInt");
  $("rcIntLbl").textContent = lbl;
  $("rcIntSub").textContent = sub;
  if (num.textContent !== val) {
    num.textContent = val;
    if (soon) { num.classList.remove("tick"); void num.offsetWidth; num.classList.add("tick"); }
  }
  const box = $("rcIntBox");
  box.classList.toggle("soon", soon);
  box.classList.toggle("urgent", soon && Number(val) <= 3);
  const remTot = Math.max(0, total - el);
  $("rcTot").textContent = bars ? `${Math.max(0, Math.ceil(remTot - 1e-6))} comp.` : fmtCount(remTot);
  $("rcTotSub").textContent = `de ${bars ? `${total} comp.` : fmtTime(Math.round(total))}`;
  $("rcBar").style.width = `${clamp(el / total, 0, 1) * 100}%`;
}
function practiceTick() {
  if (!run || run.paused) return;
  const { segs, total, unit } = run;
  let el;
  if (unit === "bars") {
    if (run.endAt) { if (ctx.currentTime >= run.endAt) finishRun(); return; }
    if (run.idx === null) return; // aún en cuenta previa
    el = run.bar + run.curBeat / state.num;
  } else {
    if (run.t0 === null) return;
    el = (performance.now() - run.t0) / 1000;
    if (el >= total) { finishRun(); return; }
    setBpm(planAt(segs, el).bpm);
  }
  const { idx, count } = planAt(segs, el), seg = segs[idx - 1];
  const label = seg && seg.meta && seg.meta.name ? seg.meta.name : seg && seg.iv ? `Intervalo ${seg.iv}/${seg.n}` : count > 1 ? `Tramo ${idx}/${count}` : "Gradual";
  $("status").textContent = label;
  updateCountdown(el);
  updateTrend(trendOf(segs, el));
  setCursor($("runGraph"), el / total);
  setCursor(document.querySelector(`.pcard[data-id="${run.p.id}"]`), el / total);
}
// Panel de la práctica: curva y controles según el estado (activa, en pausa o terminada).
function renderRunCtl() {
  const box = $("runGraph"), ctl = $("runCtl"), cur = run || runDone;
  box.hidden = !cur;
  $("viewMetro").querySelector(".hero").classList.toggle("runmode", !!run);
  $("viewMetro").classList.toggle("runpanel", !!cur);
  $("viewMetro").querySelector(".hero").classList.toggle("compact", !!cur);
  timerRender();
  ctl.innerHTML = "";
  if (!cur) { updateTrend(); return; }
  const add = (icon, label, fn, cls) => {
    const b = document.createElement("button");
    b.className = cls || "";
    b.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${label}</span>`;
    b.onclick = fn;
    ctl.appendChild(b);
  };
  if (run) {
    add("rotate-left", "Reiniciar", startLast);
    add(run.paused ? "play" : "pause", run.paused ? "Reanudar" : "Pausar", togglePlay);
    add("stop", "Terminar", endRun, "end");
  } else {
    add("rotate-left", "Reiniciar", startLast);
    add("xmark", "Cerrar", () => { runDone = null; renderRunCtl(); idleStatus(); });
  }
  updateTrend();
}
function clearPracticeUI() {
  document.querySelectorAll(".gcur").forEach((c) => { c.style.opacity = 0; });
  renderRunCtl();
}
// Con el metrónomo en reposo, un acceso directo repite la última práctica.
function idleStatus() {
  const st = $("status"), it = lastRunItem();
  if (!run && !runDone && it) {
    st.innerHTML = '<button class="lastrun"><i class="fa-solid fa-rotate-left"></i><span></span></button>';
    st.querySelector("span").textContent = `Repetir: ${it.name}`;
    st.querySelector("button").onclick = startLast;
  } else st.innerHTML = "&nbsp;";
}


function renderPractices() {
  const box = $("practiceList");
  box.innerHTML = "";
  practices.forEach((p) => {
    const last = p.last ? new Date(p.last).toLocaleDateString("es-EC", { day: "numeric", month: "short" }) : "-";
    const card = document.createElement("div");
    card.className = "pcard";
    card.dataset.id = p.id;
    card.innerHTML = `<div class="ptop"><div class="pinfo"><div class="pname"></div><div class="pmeta"></div></div><div class="pg">${graphSVG(compileSegs(p), { h: 100, labels: false, axis: false, unit: unitOf(p) })}</div></div>
      <div class="pfoot"><span class="plast">Última práctica: ${last}</span><button class="pmore" aria-label="Opciones"><i class="fa-solid fa-ellipsis"></i></button><button class="pplay" aria-label="Iniciar práctica"><i class="fa-solid fa-play"></i></button></div>`;
    card.querySelector(".pname").textContent = p.name;
    card.querySelector(".pmeta").textContent = practiceMeta(p);
    card.querySelector(".pplay").onclick = () => startPractice(p);
    card.querySelector(".pmore").onclick = () => practiceMenu(p);
    box.appendChild(card);
  });
  $("practiceEmpty").hidden = practices.length > 0;
}
async function practiceMenu(p) {
  const r = await sheet(p.name, (b) => { b.innerHTML = `<div class="pgraph-edit">${graphSVG(compileSegs(p), { h: 130, unit: unitOf(p) })}</div><p class="note">${practiceMeta(p)}</p>`; }, [
    { label: "Editar", value: "edit" }, { label: "Eliminar", cls: "danger", value: "del" }, { label: "Cerrar", value: null },
  ]);
  if (r === "edit") editPractice(p);
  else if (r === "del" && (await askConfirm("Eliminar práctica", "Se eliminará esta práctica."))) {
    practices = practices.filter((x) => x !== p); savePractices(); renderPractices();
  }
}

const SEED_IV = [{ bpm: 120, sec: 60, bars: 8, mode: "salto" }, { bpm: 100, sec: 60, bars: 8, mode: "salto" }, { bpm: 140, sec: 60, bars: 8, mode: "gradual", trans: 15, transBars: 2 }];
// Completa los campos de un intervalo (también los de prácticas guardadas con el formato anterior).
function normIv(iv) {
  if (!iv.sec) iv.sec = 60;
  if (!iv.bars) iv.bars = clamp(Math.round((iv.sec * iv.bpm) / 60 / 4), 1, 512);
  const legacy = !iv.mode && iv.ramp;
  iv.mode = iv.mode || (iv.ramp ? "gradual" : "salto");
  if (iv.trans == null) iv.trans = legacy ? iv.sec : Math.min(10, iv.sec);
  if (iv.transBars == null) iv.transBars = legacy ? iv.bars : Math.min(2, iv.bars);
  delete iv.ramp;
  return iv;
}
function editPractice(existing) {
  const d = JSON.parse(JSON.stringify(Object.assign(
    { name: "", type: "custom", unit: "time", from: 80, to: 120, steps: 4, min: 1, intervals: SEED_IV }, existing || {})));
  d.intervals.forEach(normIv);
  let nameInp, gbox, dyn;
  const updateGraph = () => {
    const segs = compileSegs(d), unit = unitOf(d);
    gbox.innerHTML = graphSVG(segs, { h: 150, unit }) +
      `<p class="note">Total ${fmtLen(unit, planTotal(segs))}${d.type === "custom" ? `, ${d.intervals.length} intervalos` : ""}</p>`;
  };
  const renderBody = () => {
    dyn.innerHTML = "";
    if (d.type === "custom") {
      const l = document.createElement("div");
      l.className = "row"; l.innerHTML = "<label>Medir los intervalos en</label>";
      dyn.appendChild(l);
      dyn.appendChild(chips([["time", "Tiempo"], ["bars", "Compases"]], d.unit, (v) => { d.unit = v; renderBody(); }));
      d.intervals.forEach((iv, i) => dyn.appendChild(ivRow(i)));
      const add = document.createElement("button");
      add.className = "btn-wide"; add.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir intervalo';
      add.disabled = d.intervals.length >= 20;
      add.onclick = () => { const l2 = d.intervals[d.intervals.length - 1]; d.intervals.push({ ...l2 }); renderBody(); };
      dyn.appendChild(add);
    } else {
      dyn.appendChild(stepper("BPM inicial", () => d.from, (v) => { d.from = v; updateGraph(); }, 20, 300, (v) => v, 5));
      dyn.appendChild(stepper("BPM final", () => d.to, (v) => { d.to = v; updateGraph(); }, 20, 300, (v) => v, 5));
      if (d.type === "fija") dyn.appendChild(stepper("Pasos", () => d.steps, (v) => { d.steps = v; updateGraph(); }, 2, 12));
      dyn.appendChild(stepper(d.type === "fija" ? "Minutos por paso" : "Minutos en total", () => d.min, (v) => { d.min = v; updateGraph(); }, 1, 60));
    }
    updateGraph();
  };
  const ivRow = (i) => {
    const iv = d.intervals[i], row = document.createElement("div"), bars = d.unit === "bars", first = i === 0;
    row.className = "iv";
    const dur = bars
      ? `<div class="iv-f"><label>Compases</label><div class="mst"><button data-a="rm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><input class="iv-in" data-k="bars" type="tel" inputmode="numeric" maxlength="3" value="${iv.bars}"><button data-a="rp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>`
      : `<div class="iv-f"><label>Duración</label><div class="mst"><button data-a="dm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><output data-o="dur">${fmtTime(iv.sec)}</output><button data-a="dp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>`;
    const gradual = !first && iv.mode === "gradual";
    const tv = bars ? iv.transBars : iv.trans;
    row.innerHTML = `<div class="iv-top"><span class="iv-n">${i + 1}</span>
      <div class="iv-f"><label>BPM</label><div class="mst"><button data-a="bm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><input class="iv-in" data-k="bpm" type="tel" inputmode="numeric" maxlength="3" value="${iv.bpm}"><button data-a="bp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>${dur}</div>
      <div class="iv-mode"><label>Cómo llega a este tempo</label>
        <div class="seg2"><button data-a="salto" class="${!gradual ? "on" : ""}"${first ? " disabled" : ""}><i class="fa-solid fa-arrow-right"></i> De golpe</button><button data-a="gradual" class="${gradual ? "on" : ""}"${first ? " disabled" : ""}><i class="fa-solid fa-chart-line"></i> Gradual</button></div>
        ${first ? '<p class="note">El primer intervalo siempre arranca directo.</p>' : ""}
      </div>
      ${gradual ? `<div class="iv-f iv-trans"><label>Tiempo de transición</label><div class="mst"><button data-a="tm" aria-label="Menos"><i class="fa-solid fa-minus"></i></button><output data-o="trans">${bars ? `${tv} comp.` : `${tv} s`}</output><button data-a="tp" aria-label="Más"><i class="fa-solid fa-plus"></i></button></div></div>` : ""}
      <div class="iv-bot"><button data-a="dup"><i class="fa-solid fa-copy"></i> Duplicar</button>
      <button data-a="del"${d.intervals.length === 1 ? " disabled" : ""}><i class="fa-solid fa-trash"></i> Quitar</button></div>`;
    const lenOf = () => (bars ? iv.bars : iv.sec);
    const fixTrans = () => {
      iv.trans = clamp(iv.trans, 5, Math.max(5, iv.sec)); iv.transBars = clamp(iv.transBars, 1, Math.max(1, iv.bars));
      const o = row.querySelector('[data-o="trans"]');
      if (o) o.textContent = bars ? `${iv.transBars} comp.` : `${iv.trans} s`;
    };
    row.querySelectorAll("input.iv-in").forEach((inp) => {
      const k = inp.dataset.k, lo = k === "bpm" ? 20 : 1, hi = k === "bpm" ? 300 : 999;
      inp.addEventListener("input", () => { const v = parseInt(inp.value, 10); if (v >= lo && v <= hi) { iv[k] = v; fixTrans(); updateGraph(); } });
      inp.addEventListener("change", () => { iv[k] = clamp(parseInt(inp.value, 10) || iv[k], lo, hi); inp.value = iv[k]; fixTrans(); updateGraph(); });
    });
    row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.a, q = (k) => row.querySelector(`[data-k="${k}"]`);
      if (a === "bm" || a === "bp") { iv.bpm = clamp(iv.bpm + (a === "bp" ? 5 : -5), 20, 300); q("bpm").value = iv.bpm; updateGraph(); }
      else if (a === "rm" || a === "rp") { iv.bars = clamp(iv.bars + (a === "rp" ? 1 : -1), 1, 999); q("bars").value = iv.bars; fixTrans(); updateGraph(); }
      else if (a === "dm" || a === "dp") { iv.sec = clamp(iv.sec + (a === "dp" ? 15 : -15), 15, 1800); row.querySelector('[data-o="dur"]').textContent = fmtTime(iv.sec); fixTrans(); updateGraph(); }
      else if (a === "tm" || a === "tp") {
        if (bars) iv.transBars = clamp(iv.transBars + (a === "tp" ? 1 : -1), 1, Math.max(1, lenOf())); else iv.trans = clamp(iv.trans + (a === "tp" ? 5 : -5), 5, Math.max(5, lenOf()));
        fixTrans(); updateGraph();
      }
      else if (a === "salto" || a === "gradual") { iv.mode = a; renderBody(); }
      else if (a === "dup") { d.intervals.splice(i + 1, 0, { ...iv }); renderBody(); }
      else if (a === "del" && d.intervals.length > 1) { d.intervals.splice(i, 1); renderBody(); }
    }));
    return row;
  };
  sheet(existing ? "Editar práctica" : "Nueva práctica", (b) => {
    nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.placeholder = "Nombre"; nameInp.maxLength = 40; nameInp.value = d.name;
    b.appendChild(nameInp);
    gbox = document.createElement("div"); gbox.className = "pgraph-edit";
    b.appendChild(gbox);
    b.appendChild(h3("Tipo"));
    b.appendChild(chips([["custom", "Personalizada"], ["fija", "Velocidad fija"], ["progresiva", "Progresiva"]], d.type, (v) => {
      if (v === "custom" && d.type !== "custom") {
        d.unit = "time";
        d.intervals = compileSegs(d).flatMap((s) => (s.from === s.to ? [{ bpm: s.to, sec: s.len, mode: "salto" }]
          : [{ bpm: s.from, sec: 15, mode: "salto" }, { bpm: s.to, sec: Math.max(15, s.len - 15), mode: "gradual", trans: Math.max(5, s.len - 15) }])).slice(0, 20);
        d.intervals.forEach(normIv);
      }
      d.type = v; renderBody();
    }));
    dyn = document.createElement("div");
    b.appendChild(dyn);
    b.insertAdjacentHTML("beforeend", '<p class="note">Personalizada: cada intervalo tiene su BPM y dura un tiempo o un número de compases. Puede llegar "de golpe" (cambio inmediato) o "gradual" (sube o baja durante el tiempo de transición y luego se mantiene). Fija: sube en pasos. Progresiva: sube de forma continua.</p>');
    renderBody();
  }, [{ label: "Cancelar", value: false }, { label: "Guardar", cls: "primary", value: true }]).then((ok) => {
    if (!ok) return;
    d.name = nameInp.value.trim() || (d.type === "custom" ? "Práctica personalizada" : d.type === "fija" ? "Práctica de velocidad fija" : "Práctica de velocidad progresiva");
    if (existing) Object.assign(existing, d);
    else practices.push(Object.assign(d, { id: Date.now(), last: 0 }));
    savePractices(); renderPractices();
  });
}
$("addPractice").addEventListener("click", () => editPractice(null));

/* ---------- Controles centrales alternativos ---------- */
// Orbe: puntos del compás alrededor y arrastre vertical para el tempo.
function renderOrbDots() {
  const box = $("orbDots");
  box.innerHTML = state.levels.map((lv, i) =>
    `<i style="--a:${(360 * i) / state.num}deg;--s:${[0.5, 0.9, 1.2, 1.6][lv]}"></i>`).join("");
}
(function setupOrb() {
  const orb = $("orb");
  let y0 = 0, bpm0 = 0, moved = 0, active = false;
  orb.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; active = true; y0 = e.clientY; bpm0 = state.bpm; moved = 0; orb.setPointerCapture(e.pointerId); });
  orb.addEventListener("pointermove", (e) => {
    if (!active) return;
    moved = Math.max(moved, Math.abs(e.clientY - y0));
    if (moved > 6) setBpm(bpm0 + (y0 - e.clientY) * 0.45);
  });
  const end = () => { if (active && moved <= 6) togglePlay(); active = false; };
  orb.addEventListener("pointerup", end);
  orb.addEventListener("pointercancel", () => { active = false; });
})();

// Regla: marcas de 1 BPM que se deslizan bajo una aguja fija, con inercia.
let rulerPos = null;
const RULER_PX = 11;
function drawRuler() {
  const cv = $("rulerCv"), view = $("rulerView");
  const r = view.getBoundingClientRect();
  if (!r.width) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  const cs = getComputedStyle(document.documentElement);
  const tick = cs.getPropertyValue("--muted").trim() || "#999", txt = cs.getPropertyValue("--text").trim() || "#fff";
  const pos = rulerPos === null ? state.bpm : rulerPos, cx = r.width / 2;
  g.textAlign = "center"; g.font = "600 12px -apple-system, sans-serif";
  for (let b = Math.floor(pos - cx / RULER_PX) - 1; b <= Math.ceil(pos + cx / RULER_PX) + 1; b++) {
    if (b < 20 || b > 300) continue;
    const x = cx + (b - pos) * RULER_PX, major = b % 10 === 0, mid = b % 5 === 0;
    const h = r.height * (major ? 0.5 : mid ? 0.36 : 0.22);
    g.strokeStyle = major ? txt : tick; g.globalAlpha = major ? 0.9 : 0.55; g.lineWidth = major ? 2 : 1.2;
    g.beginPath(); g.moveTo(x, r.height); g.lineTo(x, r.height - h); g.stroke();
    if (major) { g.globalAlpha = 0.85; g.fillStyle = txt; g.fillText(String(b), x, r.height - h - 8); }
  }
  g.globalAlpha = 1;
}
(function setupRuler() {
  const view = $("rulerView");
  let x0 = 0, p0 = 0, lastX = 0, lastT = 0, vel = 0, drag = false, raf = 0;
  const apply = (p) => { rulerPos = clamp(p, 20, 300); setBpm(rulerPos); drawRuler(); };
  view.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(raf);
    drag = true; x0 = lastX = e.clientX; lastT = performance.now(); vel = 0; p0 = rulerPos === null ? state.bpm : rulerPos;
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const now = performance.now();
    vel = clamp((e.clientX - lastX) / Math.max(1, now - lastT), -2.5, 2.5);
    lastX = e.clientX; lastT = now;
    apply(p0 - (e.clientX - x0) / RULER_PX);
  });
  const end = () => {
    if (!drag) return;
    drag = false;
    const step = () => {
      if (Math.abs(vel) < 0.02) { rulerPos = null; drawRuler(); return; }
      apply((rulerPos === null ? state.bpm : rulerPos) - (vel * 16) / RULER_PX);
      vel *= 0.94;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  if (window.ResizeObserver) new ResizeObserver(() => drawRuler()).observe(view);
})();

// Péndulo: la varilla oscila con el pulso y la pesa se arrastra para cambiar el tempo.
let swingPhase = 0, swingBeat = 0, swingAngle = 0, swingLast = performance.now();
const SWING_MAX = 26;
function pendLoop(now) {
  requestAnimationFrame(pendLoop);
  const dt = (now - swingLast) / 1000;
  swingLast = now;
  if (document.documentElement.dataset.ctl !== "pend") return;
  if (running) {
    swingPhase += (dt * state.bpm) / 60;
    swingAngle = SWING_MAX * Math.cos(Math.PI * swingPhase);
  } else swingAngle *= 0.88;
  $("rod").style.transform = `rotate(${swingAngle.toFixed(2)}deg)`;
}
requestAnimationFrame(pendLoop);
(function setupPend() {
  const pend = $("pend");
  let active = false;
  const setFrom = (e) => {
    const r = pend.getBoundingClientRect(), base = r.bottom - r.height * 0.32, len = r.height * 0.64;
    const frac = clamp((base - e.clientY) / len / 0.88, 0, 1);
    setBpm(300 - frac * 280);
  };
  pend.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    active = true; pend.setPointerCapture(e.pointerId); setFrom(e);
  });
  pend.addEventListener("pointermove", (e) => { if (active) setFrom(e); });
  pend.addEventListener("pointerup", () => { active = false; });
  pend.addEventListener("pointercancel", () => { active = false; });
})();

/* ---------- Opciones: cuenta previa, silencios, ayudas ---------- */
let wakeLock = null;
async function setWake(on) {
  if (!on) { if (wakeLock) { try { await wakeLock.release(); } catch { /* ya liberado */ } wakeLock = null; } return true; }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; refreshMore(); });
    return true;
  } catch { return false; }
}
function refreshMore() {
  $("btnMore").classList.toggle("active", !!(state.ciOn || state.gapOn || state.flashOn || state.voiceOn || wakeLock));
}
$("btnMore").addEventListener("click", () => {
  let wakeFail = false;
  sheet("Opciones", (b) => {
    const render = () => {
      b.innerHTML = "";
      b.appendChild(h3("Cuenta previa"));
      b.appendChild(switchRow("Contar antes de empezar", state.ciOn, (v) => { state.ciOn = v; persist(); refreshMore(); render(); }));
      if (state.ciOn) b.appendChild(stepper("Compases de cuenta", () => state.ciBars, (v) => { state.ciBars = v; persist(); }, 1, 4));
      b.appendChild(h3("Silencios periódicos"));
      b.appendChild(switchRow("Entrenar el pulso interno", state.gapOn, (v) => { state.gapOn = v; persist(); refreshMore(); render(); }));
      if (state.gapOn) {
        b.appendChild(stepper("Compases que suenan", () => state.gapPlay, (v) => { state.gapPlay = v; persist(); }, 1, 16));
        b.appendChild(stepper("Compases en silencio", () => state.gapMute, (v) => { state.gapMute = v; persist(); }, 1, 16));
        b.insertAdjacentHTML("beforeend", '<p class="note">El metrónomo se calla por turnos para que mantengas el pulso por tu cuenta. La pantalla sigue marcando el tiempo.</p>');
      }
      b.appendChild(h3("Ayudas"));
      b.appendChild(switchRow("Destello de pantalla en cada pulso", state.flashOn, (v) => { state.flashOn = v; persist(); refreshMore(); }));
      b.appendChild(switchRow("Voz que cuenta los pulsos", state.voiceOn, (v) => { state.voiceOn = v; persist(); refreshMore(); }));
      b.appendChild(switchRow("Mantener la pantalla encendida", !!wakeLock, async (v) => {
        wakeFail = !(await setWake(v)) && v;
        refreshMore(); render();
      }));
      if (wakeFail) b.insertAdjacentHTML("beforeend", '<p class="note">Este dispositivo no permite mantener la pantalla encendida.</p>');
    };
    render();
  }, [{ label: "Listo", cls: "primary", value: true }]);
});

/* ---------- Atajos de teclado ---------- */
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  if (!$("backdrop").hidden || document.querySelector(".view.active").id !== "viewMetro") return;
  const big = e.shiftKey ? 5 : 1;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.code === "ArrowUp" || e.code === "ArrowRight") { e.preventDefault(); setBpm(state.bpm + big); }
  else if (e.code === "ArrowDown" || e.code === "ArrowLeft") { e.preventDefault(); setBpm(state.bpm - big); }
  else if (e.code === "KeyT") $("tapBtn").click();
  else if (e.code === "KeyR") startLast();
  else if (e.code === "KeyP" && run) togglePlay();
  else if (e.code === "PageUp") setBpm(state.bpm + 10);
  else if (e.code === "PageDown") setBpm(state.bpm - 10);
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && !(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) e.preventDefault();
});

/* ---------- Afinador y bordón ---------- */
const NOTE_NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
state.a4 = clamp(state.a4 || 440, 400, 480);
state.drNote = state.drNote === undefined ? 9 : state.drNote;
state.drOct = clamp(state.drOct || 3, 1, 6);
state.drFifth = !!state.drFifth;
const midiFreq = (m) => state.a4 * Math.pow(2, (m - 69) / 12);

// Detección de tono (YIN): devuelve la frecuencia en Hz o -1 si no hay una nota clara.
function detectPitch(buf, sr) {
  const N = buf.length, W = N >> 1;
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / N) < 0.008) return -1;
  const minTau = Math.floor(sr / 1100), maxTau = Math.min(W - 1, Math.floor(sr / 65));
  const c = new Float32Array(maxTau + 2);
  let acc = 0;
  c[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
    acc += sum;
    c[tau] = acc ? (sum * tau) / acc : 1;
  }
  let tau = -1;
  for (let t = Math.max(2, minTau); t <= maxTau; t++) {
    if (c[t] < 0.12) { while (t + 1 <= maxTau && c[t + 1] < c[t]) t++; tau = t; break; }
  }
  if (tau < 0) return -1;
  const a = c[tau - 1], b = c[tau], g = c[tau + 1] === undefined ? c[tau] : c[tau + 1], den = a + g - 2 * b;
  return sr / (tau + (den ? (a - g) / (2 * den) : 0));
}
function noteInfo(freq) {
  const n = 69 + 12 * Math.log2(freq / state.a4), midi = Math.round(n);
  return { name: NOTE_NAMES[((midi % 12) + 12) % 12], oct: Math.floor(midi / 12) - 1, cents: (n - midi) * 100, midi };
}

let tunerOn = false, tunerStream = null, tunerCtx = null, tunerAn = null, tunerBuf = null, tunerRaf = 0, tunerFrame = 0, tunerHist = [], tunerLast = 0;
function tunerUI(freq) {
  const note = $("tnNote"), needle = $("tnNeedle"), meter = $("tnMeter");
  if (freq > 0) {
    tunerHist.push(freq); if (tunerHist.length > 5) tunerHist.shift();
    const f = [...tunerHist].sort((a, b) => a - b)[tunerHist.length >> 1], ni = noteInfo(f);
    tunerLast = performance.now();
    note.innerHTML = `${ni.name}<sub>${ni.oct}</sub>`;
    $("tnFreq").textContent = `${f.toFixed(1)} Hz`;
    const cents = clamp(ni.cents, -50, 50);
    needle.style.left = `${50 + cents}%`;
    $("tnCents").textContent = `${cents > 0 ? "+" : ""}${Math.round(ni.cents)} cents`;
    meter.classList.toggle("ok", Math.abs(ni.cents) < 6);
    meter.classList.remove("idle");
  } else if (performance.now() - tunerLast > 500) {
    tunerHist = [];
    note.textContent = "--";
    $("tnFreq").textContent = "Toca una nota";
    $("tnCents").textContent = "";
    needle.style.left = "50%";
    meter.classList.remove("ok"); meter.classList.add("idle");
  }
}
function tunerLoop() {
  if (!tunerOn) return;
  if (++tunerFrame % 3 === 0) {
    tunerAn.getFloatTimeDomainData(tunerBuf);
    tunerUI(detectPitch(tunerBuf, tunerCtx.sampleRate));
  }
  tunerRaf = requestAnimationFrame(tunerLoop);
}
function setTunerBtn() {
  $("tnBtn").innerHTML = tunerOn ? '<i class="fa-solid fa-microphone-slash"></i> Detener afinador' : '<i class="fa-solid fa-microphone"></i> Activar micrófono';
}
async function startTuner() {
  try {
    tunerStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    sheet("Micrófono no disponible", (b) => { b.innerHTML = '<p class="note">No se pudo usar el micrófono. Permite el acceso desde los ajustes del navegador y vuelve a intentarlo.</p>'; }, [{ label: "Entendido", cls: "primary", value: true }]);
    return;
  }
  tunerCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = tunerCtx.createMediaStreamSource(tunerStream);
  tunerAn = tunerCtx.createAnalyser();
  tunerAn.fftSize = 4096;
  src.connect(tunerAn);
  tunerBuf = new Float32Array(tunerAn.fftSize);
  tunerOn = true; tunerHist = []; tunerFrame = 0;
  setTunerBtn();
  tunerUI(-1);
  tunerLoop();
}
function stopTuner() {
  tunerOn = false;
  cancelAnimationFrame(tunerRaf);
  if (tunerStream) tunerStream.getTracks().forEach((t) => t.stop());
  if (tunerCtx) tunerCtx.close().catch(() => {});
  tunerStream = tunerCtx = tunerAn = null;
  setTunerBtn();
  $("tnNote").textContent = "--";
  $("tnFreq").textContent = "Toca una nota";
  $("tnCents").textContent = "";
  $("tnNeedle").style.left = "50%";
  $("tnMeter").classList.remove("ok"); $("tnMeter").classList.add("idle");
}
$("tnBtn").addEventListener("click", () => (tunerOn ? stopTuner() : startTuner()));
// El micrófono solo se usa mientras se está en la pestaña del afinador.
document.querySelectorAll(".tab[data-view]").forEach((t) => t.addEventListener("click", () => {
  if (tunerOn && t.dataset.view !== "viewTuner") stopTuner();
}));

// Bordón: nota sostenida con la fundamental y, si se quiere, la quinta.
let droneOn = false, droneNodes = null;
const droneFreq = () => midiFreq(12 * (state.drOct + 1) + state.drNote);
function droneStart() {
  ensureAudio();
  const g = ctx.createGain(), f = droneFreq(), oscs = [];
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.25);
  g.connect(master);
  const add = (type, mult, vol) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type; o.frequency.value = f * mult; og.gain.value = vol;
    o.connect(og); og.connect(g); o.start();
    oscs.push({ o, mult });
  };
  add("sine", 1, 0.7); add("triangle", 1, 0.3); add("sine", 0.5, 0.25);
  if (state.drFifth) add("sine", 1.5, 0.4);
  droneNodes = { g, oscs };
  droneOn = true;
  droneUI();
}
function droneRetune() {
  if (!droneNodes) return;
  const f = droneFreq();
  droneNodes.oscs.forEach(({ o, mult }) => o.frequency.setTargetAtTime(f * mult, ctx.currentTime, 0.03));
}
function droneStop() {
  if (!droneNodes) return;
  const { g, oscs } = droneNodes;
  g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
  setTimeout(() => { oscs.forEach(({ o }) => { try { o.stop(); } catch { /* ya detenido */ } }); g.disconnect(); }, 400);
  droneNodes = null; droneOn = false;
  if (!running && !tRunning && silentEl) silentEl.pause();
  droneUI();
}
function droneUI() {
  const btn = $("drBtn");
  if (!btn) return;
  btn.innerHTML = droneOn ? '<i class="fa-solid fa-stop"></i> Detener bordón' : '<i class="fa-solid fa-play"></i> Iniciar bordón';
  btn.classList.toggle("on", droneOn);
}
function renderDrone() {
  const box = $("droneBox");
  box.innerHTML = "";
  box.appendChild(h3("Nota"));
  box.appendChild(chips(NOTE_NAMES.map((n, i) => [i, n]), state.drNote, (v) => { state.drNote = v; persist(); droneRetune(); }));
  box.appendChild(stepper("Octava", () => state.drOct, (v) => { state.drOct = v; persist(); droneRetune(); }, 1, 6));
  box.appendChild(stepper("La central (Hz)", () => Math.round(state.a4), (v) => { state.a4 = v; persist(); droneRetune(); }, 400, 480));
  box.appendChild(switchRow("Añadir la quinta", state.drFifth, (v) => {
    state.drFifth = v; persist();
    if (droneOn) { droneStop(); setTimeout(droneStart, 450); }
  }));
  const btn = document.createElement("button");
  btn.className = "btn-wide"; btn.id = "drBtn";
  btn.onclick = () => (droneOn ? droneStop() : droneStart());
  box.appendChild(btn);
  droneUI();
}

/* ---------- Arranque ---------- */
applyTheme();
renderAll();
renderSongs();
renderPractices();
renderLog();
renderSongBar();
idleStatus();
renderDrone();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
