"use strict";

/* ---------- Utilidades ---------- */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};

/* ---------- Estado ---------- */
const SOUNDS = {
  click:  { name: "Clic",    type: "square",   f: [1900, 1400, 1050], d: 0.03 },
  madera: { name: "Madera",  type: "triangle", f: [950, 700, 520],    d: 0.055 },
  bloque: { name: "Bloque",  type: "sine",     f: [1250, 940, 720],   d: 0.09 },
  suave:  { name: "Suave",   type: "sine",     f: [880, 660, 520],    d: 0.14 },
};
const SUBDIVS = [
  { n: 1, name: "Negra" }, { n: 2, name: "Corcheas" }, { n: 3, name: "Tresillo" }, { n: 4, name: "Semicorcheas" },
];
const GAIN = { 3: 1, 2: 0.6, 1: 0.32, sub: 0.16 };

const saved = store.get("metro.state", {});
const state = Object.assign({
  bpm: 62, num: 4, den: 4, sub: 1, sound: "click", vol: 0.9, timerMin: 30, levels: [3, 2, 2, 2],
  tStart: false, tStop: true, tRepeat: false,
}, saved);
state.levels = normalizeLevels(state.levels, state.num);
state.timerMin = clamp(state.timerMin || 30, 1, 180);
let songs = store.get("metro.songs", []);
const persist = () => store.set("metro.state", state);

function normalizeLevels(lv, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lv && lv[i] !== undefined ? lv[i] : (i === 0 ? 3 : 2));
  return out;
}

/* ---------- Dibujo: 7 segmentos y notas ---------- */
const SEG_MAP = {
  0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg",
};
const SEG_RECT = {
  a: [6, 0, 22, 5], b: [29, 5, 5, 25], c: [29, 36, 5, 25], d: [6, 61, 22, 5], e: [0, 36, 5, 25], f: [0, 5, 5, 25], g: [6, 30.5, 22, 5],
};
function segSVG(text) {
  let x = 0, out = "";
  for (const ch of String(text)) {
    if (ch === "/") {
      out += `<polygon points="${x + 22},0 ${x + 28},0 ${x + 6},66 ${x},66" fill="#2fd0ec"/>`;
      x += 26;
      continue;
    }
    const on = SEG_MAP[ch] || "";
    for (const s in SEG_RECT) {
      const [rx, ry, w, h] = SEG_RECT[s];
      out += `<rect x="${x + rx}" y="${ry}" width="${w}" height="${h}" rx="2" fill="#2fd0ec" opacity="${on.includes(s) ? 1 : 0.07}"/>`;
    }
    x += 44;
  }
  return `<svg viewBox="0 0 ${x} 66" xmlns="http://www.w3.org/2000/svg"><g transform="skewX(-7) translate(4 0)">${out}</g></svg>`;
}
function noteSVG(kind) {
  const c = "#2fd0ec";
  const head = (cx, cy, hollow) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="5.2" transform="rotate(-20 ${cx} ${cy})" fill="${hollow ? "none" : c}" stroke="${c}" stroke-width="2"/>`;
  const stem = (x, y1, y2) => `<rect x="${x - 1.2}" y="${y1}" width="2.4" height="${y2 - y1}" fill="${c}"/>`;
  let body = "", w = 28;
  if (kind === "half") body = head(10, 40, true) + stem(16.3, 6, 40);
  else if (kind === "eighth1") body = head(10, 40, false) + stem(16.3, 6, 40) + `<path d="M17 6 C 24 12 28 20 22 30 C 25 20 21 16 17 14Z" fill="${c}"/>`;
  else if (kind === "sixteenth1") body = head(10, 40, false) + stem(16.3, 6, 40) +
    `<path d="M17 6 C 24 11 28 17 22 25 C 25 17 21 14 17 12Z" fill="${c}"/><path d="M17 15 C 24 20 28 26 22 34 C 25 26 21 23 17 21Z" fill="${c}"/>`;
  else if (kind === "pair" || kind === "quad") {
    w = 52;
    body = head(10, 40, false) + head(36, 40, false) + stem(16.3, 8, 40) + stem(42.3, 8, 40) +
      `<rect x="15" y="6" width="28.5" height="5.5" fill="${c}"/>` + (kind === "quad" ? `<rect x="15" y="15" width="28.5" height="5" fill="${c}"/>` : "");
  } else if (kind === "triplet") {
    w = 74;
    body = head(10, 42, false) + head(36, 42, false) + head(62, 42, false) +
      stem(16.3, 12, 42) + stem(42.3, 12, 42) + stem(68.3, 12, 42) + `<rect x="15" y="10" width="54.5" height="5.5" fill="${c}"/>` +
      `<text x="42" y="7" text-anchor="middle" font-size="12" font-family="-apple-system, sans-serif" font-weight="700" fill="${c}">3</text>`;
  } else body = head(10, 40, false) + stem(16.3, 6, 40);
  return `<svg viewBox="0 0 ${w} 52" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
const subKind = () => ["quarter", "pair", "triplet", "quad"][state.sub - 1];
const unitKind = () => ({ 2: "half", 4: "quarter", 8: "eighth1", 16: "sixteenth1" })[state.den] || "quarter";

/* ---------- Nombre del tempo ---------- */
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

/* ---------- Render ---------- */
function renderAll() {
  $("tempoDigits").innerHTML = segSVG(String(state.bpm).padStart(state.bpm > 99 ? 3 : 2, " ").trim());
  $("tempoName").textContent = tempoName(state.bpm);
  $("sigDigits").innerHTML = segSVG(`${state.num}/${state.den}`);
  $("sigBtn").textContent = `${state.num}/${state.den}`;
  $("beatUnit").innerHTML = noteSVG(unitKind());
  $("subIco").innerHTML = noteSVG(subKind());
  $("ring").style.transform = `rotate(${(state.bpm * 3) % 360}deg)`;
  renderPads();
  document.querySelectorAll(".toolbar button").forEach((b) => b.classList.remove("active"));
  timerRender();
  if (wakeLock) $("btnAwake").classList.add("active");
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
  $("tempoDigits").innerHTML = segSVG(String(n));
  $("tempoName").textContent = tempoName(n);
  $("ring").style.transform = `rotate(${(n * 3) % 360}deg)`;
  persist();
}
function setSignature(num, den) {
  state.num = clamp(num, 1, 12);
  state.den = den;
  state.levels = normalizeLevels(state.levels, state.num);
  beatIdx = 0;
  persist();
  renderAll();
}

/* ---------- Audio ---------- */
let ctx = null, master = null, silentEl = null;
let running = false, nextTime = 0, beatIdx = 0, subIdx = 0, timerId = null, visQueue = [], startedAt = 0;

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
function click(time, level) {
  const s = SOUNDS[state.sound];
  const idx = level === 3 ? 0 : level === 2 ? 1 : 2;
  const freq = level === "sub" ? s.f[2] * 0.85 : s.f[idx];
  const g = (GAIN[level] || 0.4);
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = s.type; o.frequency.value = freq;
  e.gain.setValueAtTime(0.0001, time);
  e.gain.exponentialRampToValueAtTime(g * (s.type === "square" ? 0.5 : 0.9), time + 0.002);
  e.gain.exponentialRampToValueAtTime(0.0001, time + s.d);
  o.connect(e); e.connect(master);
  o.start(time); o.stop(time + s.d + 0.02);
}
function scheduler() {
  const step = 60 / state.bpm / state.sub;
  while (nextTime < ctx.currentTime + 0.12) {
    if (beatIdx >= state.num) beatIdx = 0;
    if (subIdx === 0) {
      const lv = state.levels[beatIdx];
      if (lv > 0) click(nextTime, lv);
      visQueue.push({ t: nextTime, beat: beatIdx });
    } else {
      click(nextTime, "sub");
    }
    nextTime += step;
    if (++subIdx >= state.sub) { subIdx = 0; beatIdx = (beatIdx + 1) % state.num; }
  }
}
function visLoop() {
  if (!running) return;
  while (visQueue.length && visQueue[0].t <= ctx.currentTime) flash(visQueue.shift().beat);
  requestAnimationFrame(visLoop);
}
function flash(i) {
  document.querySelectorAll(".col.beat").forEach((c) => c.classList.remove("beat"));
  const c = document.querySelector(`.col[data-i="${i}"]`);
  if (c) c.classList.add("beat");
}
function start() {
  if (running) return;
  ensureAudio();
  running = true;
  beatIdx = 0; subIdx = 0; visQueue = [];
  nextTime = ctx.currentTime + 0.08;
  startedAt = performance.now();
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
  $("play").classList.remove("running");
  $("play").innerHTML = '<i class="fa-solid fa-play"></i>';
  $("status").innerHTML = "&nbsp;";
}

/* ---------- Diales y botones ---------- */
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
  if (taps.length >= 2) {
    const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    setBpm(60000 / iv);
  }
});

$("subBtn").addEventListener("click", () => { state.sub = (state.sub % 4) + 1; persist(); renderAll(); });
$("sigBtn").addEventListener("click", openSignature);
$("sigDisplay").addEventListener("click", openSignature);
$("tempoBtn").addEventListener("click", openTempoInput);

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
      b.addEventListener("click", () => close(a.value === undefined ? a.label : (typeof a.value === "function" ? a.value() : a.value)));
      act.appendChild(b);
    });
    $("backdrop").onclick = (e) => { if (e.target === $("backdrop")) close(null); };
    $("backdrop").hidden = false;
  });
}
const askConfirm = (title, text, okLabel = "Eliminar") =>
  sheet(title, (b) => { b.innerHTML = `<p class="note">${text}</p>`; },
    [{ label: "Cancelar", value: false }, { label: okLabel, cls: "danger", value: true }]);

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

function openSignature() {
  let n = state.num, d = state.den;
  sheet("Compás", (b) => {
    b.appendChild(stepper("Tiempos por compás", () => n, (v) => (n = v), 1, 12));
    const l = document.createElement("div");
    l.className = "row"; l.innerHTML = "<label>Figura que marca el pulso</label>";
    b.appendChild(l);
    b.appendChild(chips([[2, "2"], [4, "4"], [8, "8"], [16, "16"]], d, (v) => (d = v)));
  }, [{ label: "Cancelar", value: false }, { label: "Aplicar", cls: "primary", value: true }]).then((ok) => {
    if (ok) setSignature(n, d);
  });
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
$("btnSound").addEventListener("click", () => {
  sheet("Sonido", (b) => {
    b.appendChild(chips(Object.entries(SOUNDS).map(([k, v]) => [k, v.name]), state.sound, (v) => { state.sound = v; persist(); }));
    const l = document.createElement("div");
    l.className = "row"; l.innerHTML = "<label>Subdivisión</label>";
    b.appendChild(l);
    b.appendChild(chips(SUBDIVS.map((s) => [s.n, s.name]), state.sub, (v) => { state.sub = v; persist(); renderAll(); }));
  }, [{ label: "Listo", cls: "primary", value: true }]);
});
/* ---------- Temporizador ---------- */
let tRunning = false, tPaused = false, tEnd = 0, tLeft = 0, tId = null;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const timerSecs = () => (tPaused ? Math.ceil(tLeft / 1000) : Math.max(0, Math.ceil((tEnd - performance.now()) / 1000)));

function chime() {
  if (!ctx) return;
  [0, 0.2, 0.4].forEach((d) => {
    const t = ctx.currentTime + 0.05 + d, o = ctx.createOscillator(), e = ctx.createGain();
    o.type = "sine"; o.frequency.value = 1320;
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(e); e.connect(master); o.start(t); o.stop(t + 0.2);
  });
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
    $("tDur").appendChild(stepper("Duración (min)", () => state.timerMin, (v) => { state.timerMin = v; persist(); timerRender(); }, 1, 180, (v) => v, 1));
    [["tStart", "Iniciar metrónomo simultáneamente"], ["tStop", "Detener el metrónomo cuando el temporizador termine"], ["tRepeat", "Temporizador repetido"]]
      .forEach(([k, label]) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `<label>${label}</label><button class="switch${state[k] ? " on" : ""}" role="switch" aria-checked="${!!state[k]}" aria-label="${label}"></button>`;
        const sw = row.querySelector("button");
        sw.onclick = () => { state[k] = !state[k]; sw.classList.toggle("on", state[k]); sw.setAttribute("aria-checked", state[k]); persist(); };
        $("tOpts").appendChild(row);
      });
    renderCtl(); timerRender();
  }, [{ label: "Cerrar", cls: "primary", value: true }]);
}
$("btnTimer").addEventListener("click", timerSheet);
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
  if (wakeLock) { try { await wakeLock.release(); } catch {} wakeLock = null; $("btnAwake").classList.remove("active"); return; }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; $("btnAwake").classList.remove("active"); });
    $("btnAwake").classList.add("active");
  } catch {
    sheet("Pantalla encendida", (b) => { b.innerHTML = '<p class="note">Este dispositivo no permite mantener la pantalla encendida.</p>'; },
      [{ label: "Entendido", cls: "primary", value: true }]);
  }
});

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
    li.innerHTML = `<button class="info"><div class="nm"></div><div class="meta"></div></button><button class="del" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>`;
    li.querySelector(".nm").textContent = s.name;
    li.querySelector(".meta").textContent = `${s.bpm} BPM, ${s.num}/${s.den}, ${SUBDIVS[s.sub - 1].name}`;
    li.querySelector(".info").onclick = () => {
      Object.assign(state, { bpm: s.bpm, num: s.num, den: s.den, sub: s.sub, levels: normalizeLevels(s.levels, s.num) });
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
    songs.unshift({ name, bpm: state.bpm, num: state.num, den: state.den, sub: state.sub, levels: [...state.levels] });
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
    const l = document.createElement("div");
    l.className = "row"; l.innerHTML = "<label>Tipo</label>";
    b.appendChild(l);
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

/* ---------- Clave de acceso (PIN) ---------- */
const PIN_LEN = 4;
const lockEl = $("lock");
let pinBuf = "", pinMode = "enter", pinFirst = "", failCount = 0, lockedUntil = 0, hiddenAt = 0;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hashPin(pin, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256));
}
function drawDots(err) {
  const d = $("lockDots");
  d.innerHTML = "";
  for (let i = 0; i < PIN_LEN; i++) d.insertAdjacentHTML("beforeend", `<i class="${i < pinBuf.length ? "f" : ""}"></i>`);
  if (err) { d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake"); }
}
function lockMsg(title, hint, isErr) {
  $("lockTitle").textContent = title;
  $("lockHint").textContent = hint || "";
  $("lockHint").classList.toggle("err", !!isErr);
}
function showLock() {
  stop();
  pinBuf = ""; pinFirst = "";
  const cfg = store.get("metro.pin", null);
  pinMode = cfg ? "enter" : "create";
  lockMsg(cfg ? "Ingresa tu clave" : "Crea tu clave", cfg ? "" : `Elige ${PIN_LEN} dígitos para proteger la app.`);
  drawDots();
  lockEl.hidden = false;
  $("app").hidden = true;
}
function unlock() {
  lockEl.hidden = true;
  $("app").hidden = false;
}
async function submitPin() {
  const pin = pinBuf;
  pinBuf = "";
  if (pinMode === "create") {
    pinFirst = pin; pinMode = "confirm";
    lockMsg("Confirma tu clave", "Escríbela de nuevo.");
    drawDots();
  } else if (pinMode === "confirm") {
    if (pin !== pinFirst) {
      pinMode = "create"; pinFirst = "";
      lockMsg("Crea tu clave", "No coincidieron, inténtalo otra vez.", true);
      drawDots(true);
      return;
    }
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    store.set("metro.pin", { salt, hash: await hashPin(pin, salt) });
    unlock();
  } else {
    const wait = lockedUntil - Date.now();
    if (wait > 0) { lockMsg("Demasiados intentos", `Espera ${Math.ceil(wait / 1000)} s.`, true); drawDots(true); return; }
    const cfg = store.get("metro.pin", null);
    if (cfg && (await hashPin(pin, cfg.salt)) === cfg.hash) {
      failCount = 0; unlock();
    } else {
      failCount++;
      if (failCount >= 5) { lockedUntil = Date.now() + 30000; failCount = 0; lockMsg("Demasiados intentos", "Espera 30 s.", true); }
      else lockMsg("Ingresa tu clave", "Clave incorrecta.", true);
      drawDots(true);
    }
  }
}
$("keypad").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const k = b.dataset.k;
  if (k === "del") pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < PIN_LEN) pinBuf += k;
  drawDots();
  if (pinBuf.length === PIN_LEN) setTimeout(submitPin, 120);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 60000 && lockEl.hidden) showLock();
});

/* ---------- Arranque ---------- */
renderAll();
renderSongs();
renderPractices();
showLock();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=3").catch(() => {});
