/* theory.js — Musiktheorie: Tonarten, Notennamen, Tonvorräte, Frequenzen */
"use strict";

const Theory = (() => {
  // Interne Buchstaben (englisch): B = deutsches H
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Dur-Tonarten. vf = VexFlow-Name, label = deutsche Anzeige
  const KEYS = [
    { id: "C",  vf: "C",  label: "C-Dur",   accs: 0, type: "#" },
    { id: "G",  vf: "G",  label: "G-Dur",   accs: 1, type: "#" },
    { id: "D",  vf: "D",  label: "D-Dur",   accs: 2, type: "#" },
    { id: "A",  vf: "A",  label: "A-Dur",   accs: 3, type: "#" },
    { id: "E",  vf: "E",  label: "E-Dur",   accs: 4, type: "#" },
    { id: "H",  vf: "B",  label: "H-Dur",   accs: 5, type: "#" },
    { id: "Fis", vf: "F#", label: "Fis-Dur", accs: 6, type: "#" },
    { id: "F",  vf: "F",  label: "F-Dur",   accs: 1, type: "b" },
    { id: "B",  vf: "Bb", label: "B-Dur",   accs: 2, type: "b" },
    { id: "Es", vf: "Eb", label: "Es-Dur",  accs: 3, type: "b" },
    { id: "As", vf: "Ab", label: "As-Dur",  accs: 4, type: "b" },
    { id: "Des", vf: "Db", label: "Des-Dur", accs: 5, type: "b" },
    { id: "Ges", vf: "Gb", label: "Ges-Dur", accs: 6, type: "b" },
  ];

  const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
  const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

  function keyById(id) {
    return KEYS.find(k => k.id === id) || KEYS[0];
  }

  // letter -> -1 | 0 | +1 für eine Tonart
  function keyAccMap(key) {
    const m = {};
    if (key.type === "#") SHARP_ORDER.slice(0, key.accs).forEach(L => (m[L] = 1));
    else FLAT_ORDER.slice(0, key.accs).forEach(L => (m[L] = -1));
    return m;
  }

  function midiOf(letter, acc, oct) {
    return (oct + 1) * 12 + LETTER_PC[letter] + acc;
  }

  // Notenbereiche als Notenzeilen-Positionen [Buchstabe, Oktave] (inklusive)
  // klein = ohne Hilfslinien, mittel = 1 Hilfslinie, gross = 2 Hilfslinien
  const RANGES = {
    treble: {
      klein: [["E", 4], ["F", 5]],
      mittel: [["C", 4], ["A", 5]],
      gross: [["A", 3], ["C", 6]],
    },
    bass: {
      klein: [["G", 2], ["A", 3]],
      mittel: [["E", 2], ["C", 4]],
      gross: [["C", 2], ["E", 4]],
    },
  };

  // Alle leitereigenen Töne der Tonart im Bereich, als Liste von
  // { letter, acc, oct, midi, vf, clef }
  function pool(clef, rangeName, key) {
    const [[l1, o1], [l2, o2]] = RANGES[clef][rangeName];
    const accMap = keyAccMap(key);
    const out = [];
    let li = LETTERS.indexOf(l1);
    let oct = o1;
    for (let guard = 0; guard < 60; guard++) {
      const L = LETTERS[li];
      const acc = accMap[L] || 0;
      out.push({
        letter: L,
        acc,
        oct,
        midi: midiOf(L, acc, oct),
        vf: L.toLowerCase() + (acc === 1 ? "#" : acc === -1 ? "b" : "") + "/" + oct,
        clef,
      });
      if (L === l2 && oct === o2) break;
      li++;
      if (li === 7) { li = 0; oct++; }
    }
    return out;
  }

  // Deutscher Name einer geschriebenen Note (Buchstabe + Vorzeichen)
  function germanName(letter, acc) {
    if (acc === 1) return letter === "B" ? "His" : letter + "is";
    if (acc === -1)
      return { C: "Ces", D: "Des", E: "Es", F: "Fes", G: "Ges", A: "As", B: "B" }[letter];
    return letter === "B" ? "H" : letter;
  }

  const PC_SHARP = ["C", "Cis", "D", "Dis", "E", "F", "Fis", "G", "Gis", "A", "Ais", "H"];
  const PC_FLAT = ["C", "Des", "D", "Es", "E", "F", "Ges", "G", "As", "A", "B", "H"];

  // Deutscher Name aus MIDI-Nummer (ohne Schreibweisen-Kontext)
  function germanFromMidi(midi, preferFlat) {
    const pc = ((midi % 12) + 12) % 12;
    const oct = Math.floor(midi / 12) - 1;
    return { name: (preferFlat ? PC_FLAT : PC_SHARP)[pc], oct, pc };
  }

  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function midiFromFreq(f) {
    return Math.round(69 + 12 * Math.log2(f / 440));
  }

  // Abweichung in Cents von der nächstliegenden MIDI-Note
  function centsOff(f, midi) {
    return Math.round(1200 * Math.log2(f / freqOf(midi)));
  }

  return {
    KEYS, RANGES,
    keyById, keyAccMap, pool,
    germanName, germanFromMidi,
    midiOf, freqOf, midiFromFreq, centsOff,
  };
})();
