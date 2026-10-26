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
const GAIN = { 3: 1, 2: 0.6, 1: 0.32, sub: 0.16 };

/* ---------- Estado ---------- */
const saved = store.get("metro.state", {});
const state = Object.assign({
  bpm: 62, num: 4, den: 4, pat: "negra", sound: "click", vol: 0.9, timerMin: 30, levels: [3, 2, 2, 2],
  tStart: false, tStop: true, tRepeat: false, polyOn: false, polyN: 3, group: null,
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
  if (wakeLock) $("btnAwake").classList.add("active");
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
  (SOUNDS[state.sound] || SOUNDS.click).play(time, idx, GAIN[level] || 0.4);
}
function polyClick(time, first) {
  tone(time, "sine", first ? 1760 : 1320, first ? 0.55 : 0.38, 0.09);
}
function scheduler() {
  const p = patOf(state.pat), beatDur = 60 / state.bpm, step = beatDur / p.div;
  while (nextTime < ctx.currentTime + 0.12) {
    if (beatIdx >= state.num) beatIdx = 0;
    if (subIdx >= p.div) subIdx = 0;
    if (subIdx === 0) {
      const lv = state.levels[beatIdx];
      if (p.hits[0] && lv > 0) click(nextTime, lv);
      visQueue.push({ t: nextTime, beat: beatIdx });
    } else if (p.hits[subIdx]) {
      click(nextTime, "sub");
    }
    nextTime += step;
    if (++subIdx >= p.div) { subIdx = 0; beatIdx = (beatIdx + 1) % state.num; }
  }
  if (state.polyOn) {
    const pd = (beatDur * state.num) / state.polyN;
    while (polyNext < ctx.currentTime + 0.12) {
      if (polyIdx >= state.polyN) polyIdx = 0;
      polyClick(polyNext, polyIdx === 0);
      polyQueue.push({ t: polyNext, i: polyIdx });
      polyNext += pd;
      polyIdx = (polyIdx + 1) % state.polyN;
    }
  }
}
function visLoop() {
  if (!running) return;
  while (visQueue.length && visQueue[0].t <= ctx.currentTime) flash(visQueue.shift().beat);
  while (polyQueue.length && polyQueue[0].t <= ctx.currentTime) flashPoly(polyQueue.shift().i);
  requestAnimationFrame(visLoop);
}
function flash(i) {
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
function start() {
  if (running) return;
  ensureAudio();
  running = true;
  beatIdx = 0; subIdx = 0; visQueue = []; polyQueue = []; polyIdx = 0;
  nextTime = ctx.currentTime + 0.08;
  polyNext = nextTime;
  timerId = setInterval(scheduler, 25);
  scheduler();
  swingBeat = 0; swingPhase = 0;
  setPlayUI(true);
  requestAnimationFrame(visLoop);
}
function stop() {
  if (!running) return;
  running = false;
  clearInterval(timerId);
  if (run) { clearInterval(runId); run = null; }
  if (silentEl && !tRunning) silentEl.pause();
  document.querySelectorAll(".col.beat").forEach((c) => c.classList.remove("beat"));
  document.querySelectorAll("#polyDots .on").forEach((c) => c.classList.remove("on"));
  document.querySelectorAll("#orbDots .on").forEach((c) => c.classList.remove("on"));
  setPlayUI(false);
  $("status").innerHTML = "&nbsp;";
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
const togglePlay = () => (running ? stop() : start());
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
    build(body);
    const act = $("sheetActions");
    act.innerHTML = "";
    const close = (v) => { $("backdrop").hidden = true; resolve(v); };
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
  sheet("Sonido", (b) => {
    b.appendChild(chips(Object.entries(SOUNDS).map(([k, v]) => [k, v.name]), state.sound, (v) => {
      state.sound = v; persist();
      ensureAudio();
      click(ctx.currentTime + 0.02, 3);
      click(ctx.currentTime + 0.42, 2);
      setTimeout(() => { if (!running && !tRunning && silentEl) silentEl.pause(); }, 900);
    }));
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
let wakeLock = null;
$("btnAwake").addEventListener("click", async () => {
  if (wakeLock) { try { await wakeLock.release(); } catch { /* ya liberado */ } wakeLock = null; $("btnAwake").classList.remove("active"); return; }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; $("btnAwake").classList.remove("active"); });
    $("btnAwake").classList.add("active");
  } catch {
    sheet("Pantalla encendida", (b) => { b.innerHTML = '<p class="note">Este dispositivo no permite mantener la pantalla encendida.</p>'; },
      [{ label: "Entendido", cls: "primary", value: true }]);
  }
});
$("btnTheme").addEventListener("click", () => {
  sheet("Tema", (b) => {
    const g = document.createElement("div");
    g.className = "swgrid";
    THEMES.forEach(([id, name]) => {
      const s = document.createElement("button");
      s.className = "swatch" + (id === "auto" ? " auto" : "") + (id === themeChoice ? " sel" : "");
      if (id !== "auto") s.dataset.theme = id;
      const ctlFor = id === "auto" ? "Disco o regla" : CTL_NAME[CTL_BY_THEME[id]];
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

function renderSongs() {
  const ul = $("songList");
  ul.innerHTML = "";
  $("songEmpty").hidden = songs.length > 0;
  songs.forEach((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = '<button class="info"><div class="nm"></div><div class="meta"></div></button><button class="del" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>';
    li.querySelector(".nm").textContent = s.name;
    li.querySelector(".meta").textContent = `${s.bpm} BPM, ${s.num}/${s.den}, ${patOf(songPat(s)).name}${s.polyOn ? `, poli ${s.polyN}:${s.num}` : ""}`;
    li.querySelector(".info").onclick = () => {
      Object.assign(state, {
        bpm: s.bpm, num: s.num, den: s.den, pat: songPat(s), levels: normalizeLevels(s.levels, s.num),
        polyOn: !!s.polyOn, polyN: s.polyN || 3, group: null,
      });
      persist(); renderAll(); showView("viewMetro");
    };
    li.querySelector(".del").onclick = async () => {
      if (await askConfirm("Eliminar ajuste", `Se eliminará "${s.name.replace(/</g, "&lt;")}" del repertorio.`)) {
        songs.splice(i, 1); store.set("metro.songs", songs); renderSongs();
      }
    };
    ul.appendChild(li);
  });
}
$("saveCur").addEventListener("click", () => {
  let inp;
  sheet("Guardar ajuste", (b) => {
    inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = "Nombre de la pieza"; inp.maxLength = 40;
    b.appendChild(inp);
    setTimeout(() => inp.focus(), 60);
  }, [{ label: "Cancelar", value: false }, { label: "Guardar", cls: "primary", value: true }]).then((ok) => {
    const name = inp.value.trim();
    if (!ok || !name) return;
    songs.unshift({ name, bpm: state.bpm, num: state.num, den: state.den, pat: state.pat, levels: [...state.levels], polyOn: state.polyOn, polyN: state.polyN });
    store.set("metro.songs", songs); renderSongs();
  });
});

/* ---------- Modo de práctica ---------- */
let practices = store.get("metro.practices", null);
if (!practices) {
  practices = [
    { id: 1, name: "Práctica de velocidad fija", type: "fija", from: 80, to: 120, steps: 4, min: 1, last: 0 },
    { id: 2, name: "Práctica de velocidad progresiva", type: "progresiva", from: 75, to: 150, steps: 6, min: 6, last: 0 },
  ];
  store.set("metro.practices", practices);
}
const savePractices = () => store.set("metro.practices", practices);
const practiceTotal = (p) => (p.type === "fija" ? p.steps * p.min : p.min) * 60;
function practiceMeta(p) {
  return p.type === "fija"
    ? `${p.from} - ${p.to} BPM, ${p.steps} pasos de ${p.min} min`
    : `${p.from} - ${p.to} BPM, ${p.min} min en total`;
}
function practicePlan(p, el) {
  if (p.type === "fija") {
    const i = Math.min(p.steps - 1, Math.floor(el / (p.min * 60)));
    return { bpm: Math.round(p.from + ((p.to - p.from) * i) / Math.max(1, p.steps - 1)), step: i + 1 };
  }
  return { bpm: Math.round(p.from + (p.to - p.from) * Math.min(1, el / (p.min * 60))), step: 0 };
}
let run = null, runId = null;
function startPractice(p) {
  if (running) stop();
  showView("viewMetro");
  run = { p, t0: performance.now() };
  start();
  practiceTick();
  runId = setInterval(practiceTick, 250);
}
function practiceTick() {
  if (!run) return;
  const { p } = run, el = (performance.now() - run.t0) / 1000, total = practiceTotal(p);
  if (el >= total) {
    p.last = Date.now(); savePractices(); renderPractices();
    chime(); stop();
    $("status").textContent = "Práctica completada";
    return;
  }
  const { bpm, step } = practicePlan(p, el);
  setBpm(bpm);
  const left = fmtTime(Math.ceil(total - el));
  $("status").textContent = (p.type === "fija" ? `Paso ${step}/${p.steps}, ` : "Progresivo, ") + `${bpm} BPM, quedan ${left}`;
}
function renderPractices() {
  const box = $("practiceList");
  box.innerHTML = "";
  practices.forEach((p) => {
    const n = p.type === "fija" ? p.steps : 6;
    const bars = Array.from({ length: n }, (_, i) => `<span class="bar"><span style="height:${Math.round(((i + 1) / n) * 100)}%"></span></span>`).join("");
    const last = p.last ? new Date(p.last).toLocaleDateString("es-EC", { day: "numeric", month: "short" }) : "-";
    const card = document.createElement("div");
    card.className = "pcard";
    card.innerHTML = `<div class="ptop"><div class="pinfo"><div class="pname"></div><div class="pmeta"></div></div><div class="bars">${bars}</div></div>
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
  const r = await sheet(p.name, () => {}, [
    { label: "Editar", value: "edit" }, { label: "Eliminar", cls: "danger", value: "del" }, { label: "Cerrar", value: null },
  ]);
  if (r === "edit") editPractice(p);
  else if (r === "del" && (await askConfirm("Eliminar práctica", "Se eliminará esta práctica."))) {
    practices = practices.filter((x) => x !== p); savePractices(); renderPractices();
  }
}
function editPractice(existing) {
  const d = Object.assign({ name: "", type: "fija", from: 80, to: 120, steps: 4, min: 1 }, existing || {});
  let nameInp, stepsRow;
  sheet(existing ? "Editar práctica" : "Nueva práctica", (b) => {
    nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.placeholder = "Nombre"; nameInp.maxLength = 40; nameInp.value = d.name;
    b.appendChild(nameInp);
    b.appendChild(h3("Tipo"));
    b.appendChild(chips([["fija", "Velocidad fija"], ["progresiva", "Progresiva"]], d.type, (v) => { d.type = v; stepsRow.hidden = v !== "fija"; }));
    b.insertAdjacentHTML("beforeend", '<p class="note">Fija: sube en pasos y cada paso dura el tiempo indicado. Progresiva: sube de forma continua durante el tiempo total.</p>');
    b.appendChild(stepper("BPM inicial", () => d.from, (v) => (d.from = v), 20, 300, (v) => v, 5));
    b.appendChild(stepper("BPM final", () => d.to, (v) => (d.to = v), 20, 300, (v) => v, 5));
    stepsRow = stepper("Pasos", () => d.steps, (v) => (d.steps = v), 2, 12);
    stepsRow.hidden = d.type !== "fija";
    b.appendChild(stepsRow);
    b.appendChild(stepper("Minutos", () => d.min, (v) => (d.min = v), 1, 60));
  }, [{ label: "Cancelar", value: false }, { label: "Guardar", cls: "primary", value: true }]).then((ok) => {
    if (!ok) return;
    d.name = nameInp.value.trim() || (d.type === "fija" ? "Práctica de velocidad fija" : "Práctica de velocidad progresiva");
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

/* ---------- Arranque ---------- */
applyTheme();
renderAll();
renderSongs();
renderPractices();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
