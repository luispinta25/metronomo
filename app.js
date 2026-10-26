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
const SOUNDS = {
  click:  { name: "Clic",   type: "square",   f: [1900, 1400, 1050], d: 0.03 },
  madera: { name: "Madera", type: "triangle", f: [950, 700, 520],    d: 0.055 },
  bloque: { name: "Bloque", type: "sine",     f: [1250, 940, 720],   d: 0.09 },
  suave:  { name: "Suave",  type: "sine",     f: [880, 660, 520],    d: 0.14 },
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
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
  }
  master.gain.value = state.vol;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* no disponible */ }
  if (!silentEl) {
    silentEl = new Audio(silentWav());
    silentEl.loop = true;
    silentEl.setAttribute("playsinline", "");
  }
  silentEl.play().catch(() => {});
  if (ctx.state !== "running") ctx.resume();
}
function tone(time, type, freq, gain, dur) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  e.gain.setValueAtTime(0.0001, time);
  e.gain.exponentialRampToValueAtTime(gain, time + 0.002);
  e.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(e); e.connect(master);
  o.start(time); o.stop(time + dur + 0.02);
}
function click(time, level) {
  const s = SOUNDS[state.sound];
  const idx = level === 3 ? 0 : level === 2 ? 1 : 2;
  const freq = level === "sub" ? s.f[2] * 0.85 : s.f[idx];
  tone(time, s.type, freq, (GAIN[level] || 0.4) * (s.type === "square" ? 0.5 : 0.9), s.d);
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
  $("play").classList.add("running");
  $("play").innerHTML = '<i class="fa-solid fa-pause"></i>';
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
  $("play").classList.remove("running");
  $("play").innerHTML = '<i class="fa-solid fa-play"></i>';
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
holdRepeat($("minus"), -1);
holdRepeat($("plus"), 1);
$("play").addEventListener("click", () => (running ? stop() : start()));

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
      if (ctx) click(ctx.currentTime + 0.02, 3);
    }));
  }, [{ label: "Listo", cls: "primary", value: true }]);
});
$("btnVol").addEventListener("click", () => {
  sheet("Volumen", (b) => {
    const r = document.createElement("input");
    r.type = "range"; r.min = 0; r.max = 1; r.step = 0.01; r.value = state.vol;
    r.oninput = () => { state.vol = +r.value; if (master) master.gain.value = state.vol; persist(); };
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
      s.innerHTML = `<span>${name}</span>`;
      s.onclick = () => {
        themeChoice = id; store.set("metro.theme", id); applyTheme();
        g.querySelectorAll(".swatch").forEach((x) => x.classList.remove("sel"));
        s.classList.add("sel");
      };
      g.appendChild(s);
    });
    b.appendChild(g);
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

/* ---------- Arranque ---------- */
applyTheme();
renderAll();
renderSongs();
renderPractices();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
