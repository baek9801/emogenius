import { React, useState, useEffect } from "react";

function MagentaPlayer({ setProcessState, startLoading }) {
  const [core, setCore] = useState(null);
  const [tf, setTf] = useState(null);
  const [model, setModel] = useState(null);
  const [savedSeq, setSavedSeq] = useState(false);

  const STEPS_PER_QUARTER = 8;
  const Z_DIM = 256;

  const numSteps = 4;
  const numChords = 8;

  var z3;
  var chordSeqs;
  var concatSeqs;
  const [progSeqs, setProgSeqs] = useState(null);

  var chords = ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];

  function generateSample(doneCallback) {
    const z = tf.randomNormal([1, 4 * Z_DIM]);
    z.data().then((zArray) => {
      z.dispose();
      doneCallback(zArray);
    });
  }

  function concatenateSequences(seqs) {
    const seq = core.sequences.clone(seqs[0]);
    let numSteps = seqs[0].totalQuantizedSteps;
    for (let i = 1; i < seqs.length; i++) {
      const s = core.sequences.clone(seqs[i]);
      s.notes.forEach((note) => {
        note.quantizedStartStep += numSteps;
        note.quantizedEndStep += numSteps;
        seq.notes.push(note);
      });
      numSteps += s.totalQuantizedSteps;
    }
    seq.totalQuantizedSteps = numSteps;
    return seq;
  }

  function interpolateSamples(chord, doneCallback) {
    const z3Tensor = tf.tensor2d(z3, [4, Z_DIM]);
    model
      .decode(z3Tensor, 0.7, { chordProgression: [chord] }, STEPS_PER_QUARTER)
      .then((sequences) => doneCallback(sequences));
  }

  function generateInterpolations(chordIndex, result, doneCallback) {
    if (chordIndex === numChords) {
      doneCallback(result);
    } else {
      interpolateSamples(chords[chordIndex], (seqs) => {
        for (let i = 0; i < numSteps; i++) {
          result[i].push(seqs[i]);
        }
        generateInterpolations(chordIndex + 1, result, doneCallback);
      });
    }
  }

  function generateProgressions() {
    let temp = [];
    for (let i = 0; i < numSteps; i++) {
      temp.push([]);
    }
    generateInterpolations(0, temp, (seqs) => {
      chordSeqs = seqs;
      concatSeqs = chordSeqs.map((s) => concatenateSequences(s));
      setProgSeqs(
        concatSeqs.map((seq) => {
          const mergedSeq = core.sequences.mergeInstruments(seq);
          const progSeq = core.sequences.unquantizeSequence(mergedSeq);
          progSeq.ticksPerQuarter = STEPS_PER_QUARTER;
          return progSeq;
        })
      );
    });
  }

  async function saveSequence() {
    progSeqs[3].notes.forEach((note) => {
      if (note.pitch >= 24 && note.pitch <= 40) {
        // If the pitch is between 24 and 40, set the instrument to bass
        note.program = 32;
      } else {
        // For all other notes, set the instrument to piano
        note.program = 0;
      }
    });

    const midi = core.sequenceProtoToMidi(progSeqs[3]);

    const file = new Blob([midi], { type: "audio/midi" });

    try {
      const response = await fetch("/api/saveMidi", {
        method: "POST",
        body: JSON.stringify({ midi: midi }),
      });

      if (response.ok) {
        console.log(response.data);
        setSavedSeq(true);
        console.log("MIDI file saved successfully");
      } else {
        console.log(response.data);
        console.error("Failed to save MIDI file");
      }
    } catch (error) {
      console.log(response.data);
      console.error("Failed to save MIDI file", error);
    }
  }

  useEffect(() => {
    async function loadMagentaMusic() {
      const musicVAEModule = await import("@magenta/music");
      const coreModule = await import("@magenta/music");
      const tfModule = musicVAEModule.tf;
      setCore(coreModule);
      setTf(tfModule);
      setModel(
        new musicVAEModule.MusicVAE(
          "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/multitrack_chords"
        )
      );
    }
    if (startLoading) {
      loadMagentaMusic();
    }
  }, [startLoading]);

  useEffect(() => {
    if (progSeqs) {
      saveSequence();
    }
  }, [progSeqs]);

  useEffect(() => {
    if (savedSeq) {
      setProcessState(2);
    }
  }, [savedSeq]);

  useEffect(() => {
    if (model) {
      model.initialize().then(() => {
        setTimeout(() => {
          generateSample((z) => {
            z3 = z;
            generateProgressions();
          });
        }, 0);
      });
    }
  }, [model]);

  return <></>;
}

export default MagentaPlayer;
