const state = {
  tempo: 100,
  beatsPerMeasure: 4,
  subdivision: 1,
  volume: 0.75,
  accent: true,
  isPlaying: false,
  currentStep: 0,
  nextNoteTime: 0,
  schedulerId: null,
  audioContext: null,
  tapTimes: [],
  swingSide: false,
  practiceStartTime: 0,
  isMicActive: false,
  micStream: null,
  micSource: null,
  analyser: null,
  micData: null,
  micRafId: null,
  micSensitivity: 2.4,
  syncOffset: 0,
  noiseFloor: 0.012,
  previousMicLevel: 0,
  lastOnsetTime: 0,
  streak: 0,
  bestStreak: 0,
  lastMilestone: 0,
  isCalibrating: false,
  calibrationStartTime: 0,
  calibrationSamples: [],
  calibrationRafId: null,
  calibrationHitsNeeded: 8,
};

const settingsStorageKey = "metronome-settings-v1";
const lookahead = 25;
const scheduleAheadTime = 0.1;

const tempoInput = document.querySelector("#tempoInput");
const tempoSlider = document.querySelector("#tempoSlider");
const decreaseTempo = document.querySelector("#decreaseTempo");
const increaseTempo = document.querySelector("#increaseTempo");
const togglePlayback = document.querySelector("#togglePlayback");
const playIcon = document.querySelector("#playIcon");
const playLabel = document.querySelector("#playLabel");
const tapTempo = document.querySelector("#tapTempo");
const beatsPerMeasure = document.querySelector("#beatsPerMeasure");
const subdivision = document.querySelector("#subdivision");
const volume = document.querySelector("#volume");
const accentToggle = document.querySelector("#accentToggle");
const beatRow = document.querySelector("#beatRow");
const pulseRing = document.querySelector("#pulseRing");
const pendulumArm = document.querySelector("#pendulumArm");
const pendulumDot = document.querySelector("#pendulumDot");
const statusText = document.querySelector("#statusText");
const toggleMic = document.querySelector("#toggleMic");
const syncOffset = document.querySelector("#syncOffset");
const syncOffsetValue = document.querySelector("#syncOffsetValue");
const micSensitivity = document.querySelector("#micSensitivity");
const precisionReadout = document.querySelector("#precisionReadout");
const streakReadout = document.querySelector("#streakReadout");
const celebration = document.querySelector("#celebration");
const toggleCalibration = document.querySelector("#toggleCalibration");
const calibrationReadout = document.querySelector("#calibrationReadout");
const calibrationLane = document.querySelector("#calibrationLane");

function syncViewportProfile() {
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const profile = coarsePointer || mobileAgent || width < 720 ? "mobile" : "desktop";
  const orientation = width > height ? "landscape" : "portrait";

  document.documentElement.style.setProperty("--app-height", `${height}px`);
  document.body.dataset.profile = profile;
  document.body.dataset.orientation = orientation;
}

function loadSettings() {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(settingsStorageKey) || "{}");
    const savedTempo = Number(savedSettings.tempo);
    const savedBeats = Number(savedSettings.beatsPerMeasure);
    const savedSubdivision = Number(savedSettings.subdivision);
    const savedVolume = Number(savedSettings.volume);
    const savedSyncOffset = Number(savedSettings.syncOffset);
    const savedMicSensitivity = Number(savedSettings.micSensitivity);

    state.tempo = Number.isFinite(savedTempo) ? clamp(savedTempo, 30, 240) : state.tempo;
    state.beatsPerMeasure = Number.isFinite(savedBeats) ? clamp(savedBeats, 2, 7) : state.beatsPerMeasure;
    state.subdivision = Number.isFinite(savedSubdivision) ? clamp(savedSubdivision, 1, 4) : state.subdivision;
    state.volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : state.volume;
    state.accent = typeof savedSettings.accent === "boolean" ? savedSettings.accent : state.accent;
    state.syncOffset = Number.isFinite(savedSyncOffset) ? clamp(savedSyncOffset, -150, 150) : state.syncOffset;
    state.micSensitivity = Number.isFinite(savedMicSensitivity)
      ? clamp(savedMicSensitivity, 1, 5)
      : state.micSensitivity;
  } catch {
    localStorage.removeItem(settingsStorageKey);
  }
}

function saveSettings() {
  const settings = {
    tempo: state.tempo,
    beatsPerMeasure: state.beatsPerMeasure,
    subdivision: state.subdivision,
    volume: state.volume,
    accent: state.accent,
    syncOffset: state.syncOffset,
    micSensitivity: state.micSensitivity,
  };

  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

function syncControlsFromState() {
  beatsPerMeasure.value = String(state.beatsPerMeasure);
  subdivision.value = String(state.subdivision);
  volume.value = String(state.volume);
  accentToggle.checked = state.accent;
  syncOffset.value = String(state.syncOffset);
  syncOffsetValue.textContent = `${state.syncOffset} ms`;
  micSensitivity.value = String(state.micSensitivity);
  setTempo(state.tempo);
}

function syncOffsetControl() {
  syncOffset.value = String(state.syncOffset);
  syncOffsetValue.textContent = `${state.syncOffset} ms`;
  saveSettings();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setTempo(value) {
  state.tempo = clamp(Math.round(Number(value) || 100), 30, 240);
  tempoInput.value = state.tempo;
  tempoSlider.value = state.tempo;
  saveSettings();
}

function renderBeatRow() {
  beatRow.innerHTML = "";
  beatRow.style.setProperty("--beats", state.beatsPerMeasure);

  for (let index = 0; index < state.beatsPerMeasure; index += 1) {
    const dot = document.createElement("div");
    dot.className = "beat-dot";
    dot.setAttribute("aria-hidden", "true");
    beatRow.appendChild(dot);
  }
}

function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextConstructor();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
}

function updatePracticeReadout(text = "--") {
  precisionReadout.textContent = text;
  streakReadout.textContent = `Racha ${state.streak}`;
}

function flashTimingFeedback(kind) {
  document.body.classList.remove("timing-good", "timing-warn", "timing-bad");
  window.clearTimeout(state.feedbackTimeout);
  document.body.classList.add(`timing-${kind}`);
  state.feedbackTimeout = window.setTimeout(() => {
    document.body.classList.remove("timing-good", "timing-warn", "timing-bad");
  }, 260);
}

function showCelebration(message) {
  celebration.textContent = message;
  celebration.classList.add("is-visible");
  window.clearTimeout(state.celebrationTimeout);
  state.celebrationTimeout = window.setTimeout(() => {
    celebration.classList.remove("is-visible");
  }, 2600);
}

function getNearestGridDistance(noteTime) {
  if (!state.isPlaying || !state.practiceStartTime) return null;

  const stepDuration = 60 / state.tempo / state.subdivision;
  const elapsed = noteTime - state.practiceStartTime;
  const nearestStep = Math.round(elapsed / stepDuration);
  const nearestTime = state.practiceStartTime + nearestStep * stepDuration;

  return (noteTime - nearestTime) * 1000;
}

function getNearestCalibrationDistance(noteTime) {
  const beatDuration = 60 / state.tempo;
  const elapsed = noteTime - state.calibrationStartTime;
  const nearestBeat = Math.round(elapsed / beatDuration);
  const nearestTime = state.calibrationStartTime + nearestBeat * beatDuration;

  return (noteTime - nearestTime) * 1000;
}

function classifyTiming(deltaMs) {
  const absDelta = Math.abs(deltaMs);

  if (absDelta <= 35) return "good";
  if (absDelta <= 85) return "warn";
  return "bad";
}

function updateCalibrationReadout() {
  const remaining = Math.max(0, state.calibrationHitsNeeded - state.calibrationSamples.length);
  calibrationReadout.textContent = state.isCalibrating ? `${remaining} golpes` : `${state.calibrationHitsNeeded} golpes`;
}

function animateCalibrationBall() {
  if (!state.isCalibrating || !state.audioContext) return;

  const beatDuration = 60 / state.tempo;
  const elapsed = state.audioContext.currentTime - state.calibrationStartTime;
  const phase = (((elapsed % beatDuration) + beatDuration) % beatDuration) / beatDuration;
  const arc = Math.sin(phase * Math.PI);

  calibrationLane.style.setProperty("--ball-x", String(phase));
  calibrationLane.style.setProperty("--ball-y", String(arc));
  state.calibrationRafId = window.requestAnimationFrame(animateCalibrationBall);
}

function stopCalibration() {
  state.isCalibrating = false;
  window.cancelAnimationFrame(state.calibrationRafId);
  state.calibrationRafId = null;
  document.body.classList.remove("calibrating");
  toggleCalibration.classList.remove("is-active");
  toggleCalibration.textContent = "Calibrar";
  calibrationLane.style.setProperty("--ball-x", "0.5");
  calibrationLane.style.setProperty("--ball-y", "0.82");
  updateCalibrationReadout();
  statusText.textContent = state.isPlaying ? "Sonando" : state.isMicActive ? "Mic on" : "Listo";
}

function finishCalibration() {
  if (!state.calibrationSamples.length) {
    stopCalibration();
    return;
  }

  const sortedSamples = [...state.calibrationSamples].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedSamples.length / 2);
  const medianDelta =
    sortedSamples.length % 2
      ? sortedSamples[middleIndex]
      : (sortedSamples[middleIndex - 1] + sortedSamples[middleIndex]) / 2;

  state.syncOffset = clamp(Math.round(state.syncOffset - medianDelta), -150, 150);
  syncOffsetControl();
  stopCalibration();
  showCelebration(`Calibrado: ${state.syncOffset} ms`);
  precisionReadout.textContent = `${Math.round(Math.abs(medianDelta))} ms corregidos`;
}

async function startCalibration() {
  ensureAudioContext();

  if (!state.isMicActive) {
    await startMic();
  }

  if (!state.isMicActive) {
    statusText.textContent = "Activa mic";
    return;
  }

  if (state.isPlaying) {
    stop();
  }

  state.isCalibrating = true;
  state.calibrationSamples = [];
  state.calibrationStartTime = state.audioContext.currentTime + 0.8;
  state.lastOnsetTime = 0;
  document.body.classList.add("calibrating");
  toggleCalibration.classList.add("is-active");
  toggleCalibration.textContent = "Parar";
  statusText.textContent = "Calibrando";
  updateCalibrationReadout();
  animateCalibrationBall();
}

function handleCalibrationHit(detectedTime) {
  if (detectedTime < state.calibrationStartTime) return;

  const adjustedTime = detectedTime + state.syncOffset / 1000;
  const deltaMs = getNearestCalibrationDistance(adjustedTime);
  const timing = classifyTiming(deltaMs);

  state.calibrationSamples.push(deltaMs);
  flashTimingFeedback(timing);
  precisionReadout.textContent = `${Math.round(Math.abs(deltaMs))} ms ${deltaMs < 0 ? "antes" : "tarde"}`;
  updateCalibrationReadout();

  if (state.calibrationSamples.length >= state.calibrationHitsNeeded) {
    finishCalibration();
  }
}

function evaluateDetectedNote(detectedTime) {
  if (state.isCalibrating) {
    handleCalibrationHit(detectedTime);
    return;
  }

  if (!state.isPlaying) {
    statusText.textContent = "Mic listo";
    flashTimingFeedback("warn");
    return;
  }

  const adjustedTime = detectedTime + state.syncOffset / 1000;
  const deltaMs = getNearestGridDistance(adjustedTime);
  if (deltaMs === null) return;

  const timing = classifyTiming(deltaMs);
  const roundedDelta = Math.round(deltaMs);
  const label = roundedDelta === 0 ? "Exacto" : `${Math.abs(roundedDelta)} ms ${roundedDelta < 0 ? "antes" : "tarde"}`;

  flashTimingFeedback(timing);
  updatePracticeReadout(label);

  if (timing === "good") {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    if ([10, 50, 100].includes(state.streak) && state.lastMilestone !== state.streak) {
      state.lastMilestone = state.streak;
      showCelebration(`${state.streak} notas precisas seguidas`);
    }
  } else if (timing === "bad") {
    state.streak = 0;
  }

  streakReadout.textContent = `Racha ${state.streak}`;
}

function readMicLevel() {
  state.analyser.getFloatTimeDomainData(state.micData);

  let sum = 0;
  let peak = 0;

  for (const sample of state.micData) {
    const absSample = Math.abs(sample);
    sum += sample * sample;
    peak = Math.max(peak, absSample);
  }

  return Math.max(Math.sqrt(sum / state.micData.length), peak * 0.58);
}

function monitorMic() {
  if (!state.isMicActive || !state.analyser) return;

  const level = readMicLevel();
  const now = state.audioContext.currentTime;
  const sensitivityFactor = 7 - state.micSensitivity;
  const threshold = Math.max(0.012, state.noiseFloor * sensitivityFactor);
  const risingFast = level - state.previousMicLevel > threshold * 0.22;
  const refractoryDone = now - state.lastOnsetTime > 0.12;

  if (level < threshold * 0.82) {
    state.noiseFloor = state.noiseFloor * 0.985 + level * 0.015;
  }

  if (level > threshold && risingFast && refractoryDone) {
    state.lastOnsetTime = now;
    evaluateDetectedNote(now);
  }

  state.previousMicLevel = level;
  state.micRafId = window.requestAnimationFrame(monitorMic);
}

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "Sin mic";
    return;
  }

  ensureAudioContext();
  statusText.textContent = "Mic...";

  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    state.micSource = state.audioContext.createMediaStreamSource(state.micStream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.16;
    state.micData = new Float32Array(state.analyser.fftSize);
    state.noiseFloor = 0.012;
    state.previousMicLevel = 0;
    state.lastOnsetTime = 0;
    state.micSource.connect(state.analyser);
    state.isMicActive = true;
    toggleMic.classList.add("is-listening");
    toggleMic.setAttribute("aria-pressed", "true");
    toggleMic.textContent = "Oyendo";
    statusText.textContent = "Mic on";
    monitorMic();
  } catch {
    statusText.textContent = state.isPlaying ? "Sonando" : "Listo";
    toggleMic.classList.remove("is-listening");
    toggleMic.setAttribute("aria-pressed", "false");
    toggleMic.textContent = "Activar";
  }
}

function stopMic() {
  if (state.isCalibrating) {
    stopCalibration();
  }

  state.isMicActive = false;
  window.cancelAnimationFrame(state.micRafId);
  state.micRafId = null;
  state.micSource?.disconnect();
  state.micStream?.getTracks().forEach((track) => track.stop());
  state.micSource = null;
  state.micStream = null;
  state.analyser = null;
  state.micData = null;
  toggleMic.classList.remove("is-listening");
  toggleMic.setAttribute("aria-pressed", "false");
  toggleMic.textContent = "Activar";
  statusText.textContent = state.isPlaying ? "Sonando" : "Listo";
}

function playClick(time, isAccent, isSubdivision) {
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const baseVolume = state.volume * (isSubdivision ? 0.38 : 0.75);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(isAccent ? 1360 : isSubdivision ? 760 : 1020, time);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(620, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(baseVolume, 0.0001), time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.07);
}

function animateBeat(step) {
  const beatIndex = Math.floor(step / state.subdivision) % state.beatsPerMeasure;
  const isMainBeat = step % state.subdivision === 0;
  const dots = [...beatRow.children];

  dots.forEach((dot, index) => {
    dot.classList.toggle("is-active", index === beatIndex && isMainBeat);
    dot.classList.toggle("is-accent", index === 0 && state.accent && isMainBeat);
  });

  pulseRing.classList.add("is-hit");
  window.setTimeout(() => pulseRing.classList.remove("is-hit"), 90);

  state.swingSide = !state.swingSide;
  const rotation = state.swingSide ? 22 : -22;
  const dotOffset = state.swingSide ? 31 : -31;
  pendulumArm.style.transform = `rotate(${rotation}deg)`;
  pendulumDot.style.transform = `translateX(${dotOffset}px)`;
}

function scheduleNote(step, time) {
  const isMainBeat = step % state.subdivision === 0;
  const beatIndex = Math.floor(step / state.subdivision) % state.beatsPerMeasure;
  const isAccent = state.accent && beatIndex === 0 && isMainBeat;

  playClick(time, isAccent, !isMainBeat);
  window.setTimeout(() => animateBeat(step), Math.max(0, (time - state.audioContext.currentTime) * 1000));
}

function nextNote() {
  const secondsPerBeat = 60 / state.tempo;
  state.nextNoteTime += secondsPerBeat / state.subdivision;
  state.currentStep = (state.currentStep + 1) % (state.beatsPerMeasure * state.subdivision);
}

function scheduler() {
  while (state.nextNoteTime < state.audioContext.currentTime + scheduleAheadTime) {
    scheduleNote(state.currentStep, state.nextNoteTime);
    nextNote();
  }
}

function start() {
  ensureAudioContext();
  state.isPlaying = true;
  state.currentStep = 0;
  state.nextNoteTime = state.audioContext.currentTime + 0.05;
  state.practiceStartTime = state.nextNoteTime;
  state.streak = 0;
  state.lastMilestone = 0;
  updatePracticeReadout();
  state.schedulerId = window.setInterval(scheduler, lookahead);
  togglePlayback.classList.add("is-playing");
  togglePlayback.setAttribute("aria-pressed", "true");
  playIcon.textContent = "Ⅱ";
  playLabel.textContent = "Pausar";
  statusText.textContent = "Sonando";
}

function stop() {
  state.isPlaying = false;
  window.clearInterval(state.schedulerId);
  state.schedulerId = null;
  state.practiceStartTime = 0;
  togglePlayback.classList.remove("is-playing");
  togglePlayback.setAttribute("aria-pressed", "false");
  playIcon.textContent = "▶";
  playLabel.textContent = "Iniciar";
  statusText.textContent = "Listo";
  state.streak = 0;
  updatePracticeReadout();
  [...beatRow.children].forEach((dot) => dot.classList.remove("is-active", "is-accent"));
}

function handleTapTempo() {
  const now = performance.now();
  state.tapTimes = state.tapTimes.filter((time) => now - time < 2200);
  state.tapTimes.push(now);

  if (state.tapTimes.length < 2) {
    statusText.textContent = "Tap...";
    return;
  }

  const intervals = state.tapTimes.slice(1).map((time, index) => time - state.tapTimes[index]);
  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  setTempo(60000 / average);
  statusText.textContent = `${state.tempo} BPM`;
}

tempoInput.addEventListener("change", (event) => setTempo(event.target.value));
tempoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    setTempo(event.target.value);
    event.target.blur();
  }
});
tempoSlider.addEventListener("input", (event) => setTempo(event.target.value));
decreaseTempo.addEventListener("click", () => setTempo(state.tempo - 1));
increaseTempo.addEventListener("click", () => setTempo(state.tempo + 1));
tapTempo.addEventListener("click", handleTapTempo);

togglePlayback.addEventListener("click", () => {
  if (state.isPlaying) {
    stop();
  } else {
    start();
  }
});

beatsPerMeasure.addEventListener("change", (event) => {
  state.beatsPerMeasure = Number(event.target.value);
  state.currentStep = 0;
  saveSettings();
  renderBeatRow();
});

subdivision.addEventListener("change", (event) => {
  state.subdivision = Number(event.target.value);
  state.currentStep = 0;
  saveSettings();
});

volume.addEventListener("input", (event) => {
  state.volume = Number(event.target.value);
  saveSettings();
});

accentToggle.addEventListener("change", (event) => {
  state.accent = event.target.checked;
  saveSettings();
});

toggleMic.addEventListener("click", () => {
  if (state.isMicActive) {
    stopMic();
  } else {
    startMic();
  }
});

syncOffset.addEventListener("input", (event) => {
  state.syncOffset = Number(event.target.value);
  syncOffsetControl();
});

micSensitivity.addEventListener("input", (event) => {
  state.micSensitivity = Number(event.target.value);
  saveSettings();
});

toggleCalibration.addEventListener("click", () => {
  if (state.isCalibrating) {
    stopCalibration();
  } else {
    startCalibration();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    togglePlayback.click();
  }
});

window.addEventListener("resize", syncViewportProfile);
window.visualViewport?.addEventListener("resize", syncViewportProfile);
window.addEventListener("orientationchange", syncViewportProfile);

syncViewportProfile();
loadSettings();
syncControlsFromState();
updateCalibrationReadout();
renderBeatRow();
