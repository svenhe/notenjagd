/* notation.js — Notendarstellung mit VexFlow (eine Note auf einem System) */
"use strict";

const Notation = (() => {
  const W = 560;
  const H = 252;
  const STAVE_Y = 66;

  // note: { vf: "f#/4", clef: "treble"|"bass" }, key: { vf: "D", accs: n }
  function draw(container, note, key) {
    if (typeof Vex === "undefined") {
      container.innerHTML =
        '<div style="color:#b00;padding:20px">Fehler: vexflow.js fehlt.</div>';
      return;
    }
    container.innerHTML = "";
    const VF = Vex.Flow;
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    const staveW = 230 + 14 * (key.accs || 0);
    const x = Math.max(4, Math.round((W - staveW) / 2));
    const stave = new VF.Stave(x, STAVE_Y, staveW);
    stave.addClef(note.clef);
    if (key.vf && key.vf !== "C") stave.addKeySignature(key.vf);
    stave.setContext(ctx).draw();

    const sn = new VF.StaveNote({ clef: note.clef, keys: [note.vf], duration: "w" });
    VF.Formatter.FormatAndDraw(ctx, stave, [sn]);

    // SVG responsiv machen
    const svg = container.querySelector("svg");
    if (svg) {
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
    }
  }

  return { draw, W, H };
})();
