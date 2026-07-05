/* sound.js — Klangausgabe: Richtig-/Falsch-Feedback, Ton vorspielen */
"use strict";

const Sound = (() => {
  let ctx = null;
  let busyUntil = 0; // performance.now()-Zeitstempel: solange spielt gerade ein Klang

  function init(audioCtx) {
    ctx = audioCtx;
  }

  function tone(freq, t0, dur, type, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function busy(ms) {
    busyUntil = performance.now() + ms;
    return busyUntil;
  }

  // Richtig: kurzes, freundliches Doppel-Pling
  function ding() {
    if (!ctx) return busy(0);
    const t = ctx.currentTime;
    tone(988, t, 0.09, "sine", 0.22);
    tone(1319, t + 0.09, 0.18, "sine", 0.22);
    return busy(360);
  }

  // Falsch: tiefer Brummer
  function buzz() {
    if (!ctx) return busy(0);
    const t = ctx.currentTime;
    tone(98, t, 0.22, "sawtooth", 0.2);
    tone(93, t + 0.02, 0.2, "square", 0.1);
    return busy(450);
  }

  // Countdown-Tick (dezent)
  function tick(high) {
    if (!ctx) return busy(0);
    const t = ctx.currentTime;
    tone(high ? 1568 : 784, t, 0.07, "sine", 0.15);
    return busy(180);
  }

  // Zielton vorspielen (klavierähnlich einfach)
  function note(midi, dur) {
    if (!ctx) return busy(0);
    dur = dur || 1.0;
    const f = Theory.freqOf(midi);
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = f;
    o1.connect(g);
    o1.start(t);
    o1.stop(t + dur + 0.05);
    const g2 = ctx.createGain();
    g2.gain.value = 0.18; // Oberton
    g2.connect(g);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2;
    o2.connect(g2);
    o2.start(t);
    o2.stop(t + dur + 0.05);
    return busy(dur * 1000 + 200);
  }

  return {
    init, ding, buzz, tick, note,
    get busyUntil() { return busyUntil; },
  };
})();
