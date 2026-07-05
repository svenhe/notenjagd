/* pitch.js — Tonhöhenerkennung über das Mikrofon (Autokorrelation) */
"use strict";

const Pitch = (() => {
  let ctx = null;
  let analyser = null;
  let buf = null;
  let stream = null;
  let fake = false;        // Testmodus: synthetischer Ton statt Mikrofon
  let testFreq = null;     // Frequenz im Testmodus (null = Stille)
  let rmsGate = 0.01;      // Lautstärkeschwelle
  let lastSounding = false;

  // useFake: true => kein Mikrofon anfordern, Signal wird synthetisiert
  async function init(audioCtx, useFake) {
    ctx = audioCtx;
    fake = !!useFake;
    buf = new Float32Array(2048);
    if (fake) return true;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return true;
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    analyser = null;
    lastSounding = false;
  }

  function setGate(v) { rmsGate = v; }
  function setTestFreq(f) { testFreq = f; }

  // Klassische Autokorrelation (nach Chris Wilsons PitchDetect), mit
  // Lautstärke-Hysterese und Klarheits-Check.
  function autoCorrelate(b, sampleRate) {
    const SIZE0 = b.length;
    let rms = 0;
    for (let i = 0; i < SIZE0; i++) { const v = b[i]; rms += v * v; }
    rms = Math.sqrt(rms / SIZE0);
    // Hysterese: ein bereits klingender Ton darf leiser ausklingen
    const gate = lastSounding ? rmsGate * 0.6 : rmsGate;
    if (rms < gate) { lastSounding = false; return { freq: -1, rms }; }

    // Ränder unterhalb Schwelle abschneiden (Ein-/Ausschwingen)
    let r1 = 0, r2 = SIZE0 - 1;
    const th = 0.2;
    for (let i = 0; i < SIZE0 / 2; i++) if (Math.abs(b[i]) < th) { r1 = i; break; }
    for (let i = 1; i < SIZE0 / 2; i++) if (Math.abs(b[SIZE0 - i]) < th) { r2 = SIZE0 - i; break; }
    const b2 = b.slice(r1, r2);
    const SIZE = b2.length;
    if (SIZE < 128) { lastSounding = false; return { freq: -1, rms }; }

    // Nur relevante Verschiebungen berechnen (50 Hz … 2200 Hz)
    const maxLag = Math.min(SIZE - 32, Math.floor(sampleRate / 50));
    const c = new Float32Array(maxLag);
    for (let lag = 0; lag < maxLag; lag++) {
      let s = 0;
      for (let j = 0; j < SIZE - lag; j++) s += b2[j] * b2[j + lag];
      c[lag] = s;
    }

    let d = 0;
    while (d + 1 < maxLag && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < maxLag; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    if (maxpos <= 0 || c[0] <= 0 || maxval / c[0] < 0.45) {
      lastSounding = false;
      return { freq: -1, rms };
    }

    // Parabel-Interpolation um das Maximum
    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = T0 + 1 < maxLag ? c[T0 + 1] : x2;
    const a = (x1 + x3 - 2 * x2) / 2;
    const bb = (x3 - x1) / 2;
    if (a) T0 = T0 - bb / (2 * a);

    const freq = sampleRate / T0;
    if (freq < 50 || freq > 2200) { lastSounding = false; return { freq: -1, rms }; }
    lastSounding = true;
    return { freq, rms };
  }

  // Einen Analyse-Frame lesen: { freq, rms }; freq = -1 wenn kein Ton
  function read() {
    const sr = ctx ? ctx.sampleRate : 48000;
    if (fake) {
      if (testFreq == null) {
        buf.fill(0);
      } else {
        const w = (2 * Math.PI * testFreq) / sr;
        for (let i = 0; i < buf.length; i++) buf[i] = 0.35 * Math.sin(w * i);
      }
    } else {
      if (!analyser) return { freq: -1, rms: 0 };
      analyser.getFloatTimeDomainData(buf);
    }
    return autoCorrelate(buf, sr);
  }

  return { init, stop, read, setGate, setTestFreq, autoCorrelate };
})();
