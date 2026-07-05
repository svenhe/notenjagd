/* game.js — Spiellogik, UI-Verdrahtung, Punkte, Timer, Rekorde */
"use strict";

(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const PARAMS = new URLSearchParams(location.search);
  const TEST = PARAMS.has("mictest"); // Testmodus: synthetischer Ton statt Mikrofon

  const GATES = { hoch: 0.004, mittel: 0.01, niedrig: 0.025 };

  const DEFAULTS = {
    clef: "treble",   // treble | bass | both
    key: "C",         // Theory.KEYS id
    range: "mittel",  // klein | mittel | gross
    dur: 60,          // Sekunden
    input: "mic",     // mic | tap | both
    sens: "mittel",   // hoch | mittel | niedrig
    vorspielen: false,
    oktave: false,    // true = Oktave muss stimmen
  };

  let settings = loadJSON("nj_settings", { ...DEFAULTS });
  settings = { ...DEFAULTS, ...settings };

  let audioCtx = null;
  let st = null;          // Spielzustand
  let flashTimer = null;
  let feedbackTimer = null;
  let toastTimer = null;
  let wakeLock = null;

  // ---------- Hilfsfunktionen ----------
  function loadJSON(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function showScreen(name) {
    $$(".screen").forEach(s => s.classList.remove("active"));
    $("#scr" + name).classList.add("active");
  }

  function toast(msg, ms) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), ms || 3500);
  }

  function showOverlay(html) {
    $("#overlayTxt").innerHTML = html;
    $("#overlay").classList.remove("hidden");
  }
  function hideOverlay() {
    $("#overlay").classList.add("hidden");
  }

  async function requestWL() {
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  }
  function releaseWL() {
    try { wakeLock?.release(); } catch (e) {}
    wakeLock = null;
  }

  function vibrate(pattern) {
    try { navigator.vibrate?.(pattern); } catch (e) {}
  }

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      Sound.init(audioCtx);
    }
  }

  function hsKey(s) {
    s = s || settings;
    return [s.clef, s.key, s.range, s.dur, s.oktave ? 1 : 0, s.input].join("|");
  }

  function currentKeyInfo() {
    return Theory.keyById(settings.key);
  }

  // ---------- Spielzustand ----------
  function freshState() {
    return {
      running: false,
      paused: false,
      starting: true,
      score: 0, right: 0, wrong: 0,
      endTime: 0, remaining: 0,
      target: null,
      pools: null,
      key: currentKeyInfo(),
      inputMode: settings.input,
      micOK: false,
      muteUntil: 0,
      // Erkennungs-Zustandsmaschine
      hist: [], stableNote: null, lastEvent: null, lastEventAt: 0, silence: 0,
      tapLock: 0,
      lastTick: 0,
    };
  }

  function buildPools() {
    st.pools = {
      treble: Theory.pool("treble", settings.range, st.key),
      bass: Theory.pool("bass", settings.range, st.key),
    };
  }

  function addMute(untilTs) {
    st.muteUntil = Math.max(st.muteUntil, untilTs + 150);
  }

  // ---------- Spielablauf ----------
  async function startGame() {
    const btn = $("#btnStart");
    btn.disabled = true;
    try {
      ensureCtx();
      try { await audioCtx.resume(); } catch (e) {}

      st = freshState();
      buildPools();

      Pitch.setGate(GATES[settings.sens] || GATES.mittel);

      let inputMode = settings.input;
      if (inputMode !== "tap") {
        try {
          await Pitch.init(audioCtx, TEST);
          st.micOK = true;
        } catch (e) {
          st.micOK = false;
          inputMode = "tap";
          toast("Mikrofon nicht verfügbar – Bildschirm‑Tasten aktiviert.");
        }
      }
      st.inputMode = inputMode;

      // UI vorbereiten
      showScreen("Game");
      $("#score").textContent = "0";
      $("#feedback").textContent = "";
      $("#staff").innerHTML = "";
      $("#flash").className = "flash";
      $("#piano").classList.toggle("hidden", inputMode === "mic");
      $("#tuner").classList.toggle("hidden", inputMode === "tap");
      $("#btnReplay").classList.toggle("hidden", !settings.vorspielen);
      updateTimeUI(settings.dur * 1000);

      await countdown();

      st.starting = false;
      st.running = true;
      st.endTime = performance.now() + settings.dur * 1000;
      st.muteUntil = performance.now() + 300;
      nextNote();
      requestWL();
      requestAnimationFrame(loop);
    } finally {
      btn.disabled = false;
    }
  }

  function countdown() {
    return new Promise(res => {
      const seq = TEST ? ["Los!"] : ["3", "2", "1", "Los!"];
      let i = 0;
      showOverlay(seq[0]);
      if (!TEST) Sound.tick(false);
      const iv = setInterval(() => {
        i++;
        if (i >= seq.length) {
          clearInterval(iv);
          hideOverlay();
          res();
          return;
        }
        showOverlay(seq[i]);
        if (!TEST) Sound.tick(seq[i] === "Los!");
      }, TEST ? 350 : 850);
    });
  }

  function nextNote() {
    const clef = settings.clef === "both"
      ? (Math.random() < 0.5 ? "treble" : "bass")
      : settings.clef;
    const pool = st.pools[clef];
    const prev = st.target;
    let cand = pool;
    if (prev) {
      cand = pool.filter(n => settings.oktave
        ? n.midi !== prev.midi
        : (n.midi % 12) !== (prev.midi % 12));
      if (!cand.length) cand = pool;
    }
    st.target = cand[(Math.random() * cand.length) | 0];
    Notation.draw($("#staff"), st.target, st.key);
    if (settings.vorspielen) {
      setTimeout(() => { if (st && st.running) playTarget(); }, 250);
    }
  }

  function playTarget() {
    if (!st || !st.target) return;
    addMute(Sound.note(st.target.midi));
  }

  function loop(ts) {
    if (!st || !st.running) return;
    if (ts - st.lastTick >= 25) {
      st.lastTick = ts;
      if (st.inputMode !== "tap" && st.micOK) {
        handleFrame(Pitch.read());
      }
    }
    const rem = st.endTime - performance.now();
    updateTimeUI(rem);
    if (rem <= 0) { endGame(); return; }
    requestAnimationFrame(loop);
  }

  // ---------- Erkennung: Frame -> Noten-Ereignis ----------
  function handleFrame(r) {
    const now = performance.now();
    updateTuner(r);
    if (now < st.muteUntil) return;

    if (r.freq < 0) {
      st.silence++;
      if (st.silence >= 6) { st.hist.length = 0; st.stableNote = null; }
      if (st.silence >= 14) { st.lastEvent = null; }
      return;
    }
    st.silence = 0;

    const m = Theory.midiFromFreq(r.freq);
    st.hist.push(m);
    if (st.hist.length > 4) st.hist.shift();
    if (st.hist.length < 4) return;
    for (let i = 1; i < 4; i++) if (st.hist[i] !== st.hist[0]) return;

    if (m === st.stableNote) return;   // derselbe Ton klingt weiter
    st.stableNote = m;
    if (m === st.lastEvent) return;    // schon bewertet (z.B. nach Stummphase)
    if (now - st.lastEventAt < 300) return;
    st.lastEvent = m;
    st.lastEventAt = now;
    judge(m, "mic");
  }

  function updateTuner(r) {
    const needle = $("#needle");
    if (r.freq > 0) {
      const m = Theory.midiFromFreq(r.freq);
      const cents = Theory.centsOff(r.freq, m);
      const gn = Theory.germanFromMidi(m, st.key.type === "b");
      $("#heardName").textContent = gn.name + (settings.oktave ? gn.oct : "");
      const cl = Math.max(-50, Math.min(50, cents));
      needle.style.transform = "translateX(" + Math.round((cl / 50) * 55) + "px)";
      needle.classList.toggle("good", Math.abs(cents) < 15);
    } else {
      $("#heardName").textContent = "–";
      needle.style.transform = "translateX(0)";
      needle.classList.remove("good");
    }
    $("#levelFill").style.width = Math.min(100, Math.round(r.rms * 900)) + "%";
  }

  // ---------- Bewertung ----------
  function judge(m, source) {
    if (!st || !st.running) return;
    const t = st.target;
    const ok = settings.oktave
      ? m === t.midi
      : (((m - t.midi) % 12) + 12) % 12 === 0;

    if (ok) {
      st.score++;
      st.right++;
      showFlash(true, Theory.germanName(t.letter, t.acc) + " ✓");
      setFeedback("");
      addMute(Sound.ding());
      vibrate(30);
      nextNote();
    } else {
      st.score--;
      st.wrong++;
      const gn = Theory.germanFromMidi(m, st.key.type === "b");
      showFlash(false, "✗");
      setFeedback("Gehört: " + gn.name + (settings.oktave ? gn.oct : ""));
      addMute(Sound.buzz());
      vibrate([60, 50, 60]);
    }
    const sc = $("#score");
    sc.textContent = st.score;
    sc.classList.remove("pop");
    void sc.offsetWidth;
    sc.classList.add("pop");
  }

  function showFlash(ok, txt) {
    const fl = $("#flash");
    fl.textContent = txt;
    fl.className = "flash show " + (ok ? "ok" : "bad");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { fl.className = "flash"; }, 700);
  }

  function setFeedback(txt) {
    const fb = $("#feedback");
    fb.textContent = txt;
    clearTimeout(feedbackTimer);
    if (txt) feedbackTimer = setTimeout(() => { fb.textContent = ""; }, 2000);
  }

  // ---------- Bildschirm-Klaviatur ----------
  function tapNote(pc) {
    if (!st || !st.running || st.paused) return;
    const now = performance.now();
    if (now < st.tapLock) return;
    st.tapLock = now + 280;
    const t = st.target;
    let d = (((pc - t.midi) % 12) + 12) % 12;
    if (d > 6) d -= 12;
    judge(t.midi + d, "tap");
  }

  function buildPiano() {
    const piano = $("#piano");
    const whites = document.createElement("div");
    whites.className = "whites";
    const WHITE = [[0, "C"], [2, "D"], [4, "E"], [5, "F"], [7, "G"], [9, "A"], [11, "H"]];
    WHITE.forEach(([pc, name]) => {
      const b = document.createElement("button");
      b.className = "wk";
      b.textContent = name;
      b.dataset.pc = pc;
      b.addEventListener("pointerdown", e => { e.preventDefault(); tapNote(pc); });
      whites.appendChild(b);
    });
    piano.appendChild(whites);
    const BLACK = [[1, "Cis", 1], [3, "Es", 2], [6, "Fis", 4], [8, "As", 5], [10, "B", 6]];
    BLACK.forEach(([pc, name, k]) => {
      const b = document.createElement("button");
      b.className = "bk";
      b.textContent = name;
      b.dataset.pc = pc;
      b.style.left = (k * (100 / 7) - 4.75) + "%";
      b.addEventListener("pointerdown", e => { e.preventDefault(); tapNote(pc); });
      piano.appendChild(b);
    });
  }

  // ---------- Timer / Ende ----------
  function fmtTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function updateTimeUI(rem) {
    $("#timeTxt").textContent = fmtTime(rem);
    const frac = Math.max(0, Math.min(1, rem / (settings.dur * 1000)));
    const fill = $("#timeFill");
    fill.style.width = (frac * 100) + "%";
    fill.classList.toggle("urgent", rem <= 10500 && rem > 0);
  }

  function endGame() {
    st.running = false;
    Pitch.stop();
    releaseWL();

    const hs = loadJSON("nj_hiscores", {});
    const k = hsKey();
    const old = Object.prototype.hasOwnProperty.call(hs, k) ? hs[k] : null;
    const beaten = old !== null && st.score > old;
    if (old === null || st.score > old) {
      hs[k] = st.score;
      saveJSON("nj_hiscores", hs);
    }

    $("#endScore").textContent = st.score;
    const total = st.right + st.wrong;
    let stats = "Richtig: " + st.right + " · Falsch: " + st.wrong;
    if (total > 0) stats += " · " + Math.round((st.right / total) * 100) + " % Trefferquote";
    $("#endStats").textContent = stats;
    $("#endRekord").innerHTML = beaten
      ? "🎉 Neuer Rekord! (vorher: " + old + ")"
      : "🏆 Rekord: " + (old === null ? st.score : Math.max(old, st.score)) + " Punkte";
    showScreen("End");
  }

  function quitGame() {
    if (st) st.running = false;
    Pitch.stop();
    releaseWL();
    hideOverlay();
    showScreen("Settings");
    updateRekordLine();
  }

  // ---------- Pause bei App-Wechsel ----------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && st && st.running && !TEST) pauseGame();
  });

  function pauseGame() {
    st.running = false;
    st.paused = true;
    st.remaining = st.endTime - performance.now();
    showOverlay("⏸<small>Tippen zum Weiterspielen</small>");
  }

  $("#overlay").addEventListener("click", () => {
    if (st && st.paused) {
      st.paused = false;
      st.running = true;
      st.endTime = performance.now() + st.remaining;
      st.muteUntil = performance.now() + 500;
      hideOverlay();
      requestWL();
      requestAnimationFrame(loop);
    }
  });

  // ---------- Einstellungen: UI ----------
  function wireSettings() {
    // Segment-Buttons
    $$(".seg").forEach(seg => {
      const key = seg.dataset.setting;
      seg.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        settings[key] = btn.dataset.val;
        saveJSON("nj_settings", settings);
        refreshSettingsUI();
      });
    });

    // Tonart
    const sel = $("#selKey");
    Theory.KEYS.forEach(k => {
      const o = document.createElement("option");
      o.value = k.id;
      const sig = k.accs === 0 ? "" :
        " (" + k.accs + " " + (k.type === "#" ? "♯" : "♭") + ")";
      o.textContent = k.label + sig;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      settings.key = sel.value;
      saveJSON("nj_settings", settings);
      updateRekordLine();
    });

    // Dauer
    $("#selDur").addEventListener("change", () => {
      settings.dur = parseInt($("#selDur").value, 10);
      saveJSON("nj_settings", settings);
      updateRekordLine();
    });

    // Checkboxen
    $("#chkPlay").addEventListener("change", () => {
      settings.vorspielen = $("#chkPlay").checked;
      saveJSON("nj_settings", settings);
    });
    $("#chkOct").addEventListener("change", () => {
      settings.oktave = $("#chkOct").checked;
      saveJSON("nj_settings", settings);
      updateRekordLine();
    });

    $("#btnStart").addEventListener("click", startGame);
    $("#btnQuit").addEventListener("click", quitGame);
    $("#btnReplay").addEventListener("click", () => { if (st && st.running) playTarget(); });
    $("#btnAgain").addEventListener("click", startGame);
    $("#btnToSettings").addEventListener("click", () => {
      showScreen("Settings");
      updateRekordLine();
    });
  }

  function refreshSettingsUI() {
    $$(".seg").forEach(seg => {
      const key = seg.dataset.setting;
      seg.querySelectorAll("button").forEach(b => {
        b.classList.toggle("on", b.dataset.val === String(settings[key]));
      });
    });
    $("#selKey").value = settings.key;
    $("#selDur").value = String(settings.dur);
    $("#chkPlay").checked = !!settings.vorspielen;
    $("#chkOct").checked = !!settings.oktave;
    $("#fieldSens").classList.toggle("hidden", settings.input === "tap");
    updateRekordLine();
  }

  function updateRekordLine() {
    const hs = loadJSON("nj_hiscores", {});
    const k = hsKey();
    const line = $("#rekordLine");
    if (Object.prototype.hasOwnProperty.call(hs, k)) {
      line.textContent = "🏆 Rekord für diese Einstellungen: " + hs[k] + " Punkte";
    } else {
      line.textContent = "Noch kein Rekord für diese Einstellungen – leg los!";
    }
  }

  // ---------- Selbsttests (über Konsole aufrufbar) ----------
  function runSelfTests() {
    const T = [];
    const eq = (name, got, want) => T.push({ name, ok: got === want, got, want });

    eq("freqOf A4", Math.round(Theory.freqOf(69)), 440);
    eq("midiFromFreq 442", Theory.midiFromFreq(442), 69);
    eq("centsOff 445", Theory.centsOff(445, 69) > 0, true);

    const ck = Theory.keyById("C");
    const p = Theory.pool("treble", "mittel", ck);
    eq("Pool C-Dur mittel: 13 Töne", p.length, 13);
    eq("Pool beginnt bei C4 (60)", p[0].midi, 60);
    eq("Pool endet bei A5 (81)", p[p.length - 1].midi, 81);

    const dk = Theory.keyById("D");
    const pd = Theory.pool("treble", "klein", dk);
    eq("D-Dur enthält fis/4", pd.some(n => n.vf === "f#/4"), true);
    eq("D-Dur enthält cis/5", pd.some(n => n.vf === "c#/5"), true);
    eq("D-Dur: kein f/4", pd.some(n => n.vf === "f/4"), false);

    const bk = Theory.keyById("B"); // B-Dur (2b)
    const pb = Theory.pool("bass", "mittel", bk);
    eq("B-Dur Bass enthält bb/2", pb.some(n => n.vf === "bb/2"), true);
    eq("Bass mittel beginnt E2 (40)", pb[0].midi === 40 || pb[0].midi === 39, true); // Es2 in b-Tonarten

    eq("Name H", Theory.germanName("B", 0), "H");
    eq("Name B", Theory.germanName("B", -1), "B");
    eq("Name Es", Theory.germanName("E", -1), "Es");
    eq("Name Fis", Theory.germanName("F", 1), "Fis");
    eq("Name As", Theory.germanName("A", -1), "As");

    // Autokorrelation mit synthetischen Sinustönen
    const sr = 48000;
    [82.41, 220, 440, 1046.5].forEach(f => {
      const buf = new Float32Array(2048);
      for (let i = 0; i < buf.length; i++) buf[i] = 0.3 * Math.sin(2 * Math.PI * f * i / sr);
      const r = Pitch.autoCorrelate(buf, sr);
      T.push({
        name: "ACF " + f + " Hz",
        ok: r.freq > 0 && Math.abs(1200 * Math.log2(r.freq / f)) < 12,
        got: Math.round(r.freq * 10) / 10, want: f,
      });
    });
    // Stille
    const silent = new Float32Array(2048);
    eq("ACF Stille -> -1", Pitch.autoCorrelate(silent, sr).freq, -1);

    return T;
  }

  // ---------- Start ----------
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    if (typeof Vex === "undefined") {
      toast("Fehler: vexflow.js konnte nicht geladen werden.", 8000);
    }
    wireSettings();
    buildPiano();
    refreshSettingsUI();
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  // Debug-/Test-Schnittstelle
  window.App = {
    runSelfTests,
    tapNote,
    setTestFreq: f => Pitch.setTestFreq(f),
    state: () => st,
    settings: () => settings,
    setDur: s => { settings.dur = s; },
    start: startGame,
    TEST,
  };
})();
