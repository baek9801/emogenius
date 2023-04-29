import { React, useState, useEffect } from "react";

export default function MagentaPlayer({ setProcessState, startLoading }) {
  const [core, setCore] = useState(null);
  const [tf, setTf] = useState(null);
  const [model, setModel] = useState(null);
  const [savedSeq, setSavedSeq] = useState(false);

  const STEPS_PER_QUARTER = 8;
  const Z_DIM = 256;

  const numSteps = 4;
  const numChords = 4;

  const [z1, setZ1] = useState(null);
  const [progSeqs, setProgSeqs] = useState(null);

  const chords = ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];

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

  async function generateChordSequences(chord) {
    const z1Tensor = tf.tensor2d(z1, [4, Z_DIM]);
    const sequences = await model.decode(
      z1Tensor,
      0.7,
      { chordProgression: [chord] },
      STEPS_PER_QUARTER
    );
    return sequences;
  }

  async function generateChordProgressions(chordIndex, result) {
    if (chordIndex === numChords) {
      return result;
    } else {
      const seqs = await generateChordSequences(chords[chordIndex]);
      for (let i = 0; i < numSteps; i++) {
        result[i].push(seqs[i]);
      }
      return generateChordProgressions(chordIndex + 1, result);
    }
  }

  useEffect(() => {
    async function loadMagentaMusic() {
      const coreModule = await import("@magenta/music");
      setCore(coreModule);
      setTf(coreModule.tf);
      setModel(
        new coreModule.MusicVAE(
          "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/multitrack_chords"
        )
      );
    }
    if (startLoading) {
      loadMagentaMusic();
    }
  }, [startLoading]);

  useEffect(() => {
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
    async function generateSample() {
      const z = tf.randomNormal([1, 4 * Z_DIM]);
      const zArray = await z.data();
      z.dispose();
      setZ1(zArray);
    }
    if (model) {
      model.initialize().then(() => {
        generateSample();
      });
    }
  }, [model]);

  useEffect(() => {
    async function generateProgressions() {
      let temp = [];
      for (let i = 0; i < numSteps; i++) {
        temp.push([]);
      }
      const seqs = await generateChordProgressions(0, temp);
      const concatenatedSeqs = seqs.map((s) => concatenateSequences(s));
      setProgSeqs(
        concatenatedSeqs.map((seq) => {
          const mergedSeq = core.sequences.mergeInstruments(seq);
          const progSeq = core.sequences.unquantizeSequence(mergedSeq);
          progSeq.ticksPerQuarter = STEPS_PER_QUARTER;
          return progSeq;
        })
      );
    }
    if (z1) {
      generateProgressions();
    }
  }, [z1]);

  return <></>;
}
