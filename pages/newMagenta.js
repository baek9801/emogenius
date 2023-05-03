import { React, useState, useEffect } from "react";

export default function MagentaPlayer({
  setProcessState,
  startLoading,
  emotions,
  /*
  0: 중립
  1: 슬픔
  2: 행복+슬픔
  3: 행복
  4: 행복+화남
  5: 슬픔+화남
  6: 화남
  */
}) {
  const [core, setCore] = useState(null);
  const [tf, setTf] = useState(null);
  const [model, setModel] = useState(null);
  const [zTensor, setZTensor] = useState(null);
  const [progSeqs, setProgSeqs] = useState(null);
  const [chords, setChords] = useState([]);

  const STEPS_PER_QUARTER = 10;
  const Z_DIM = 256;

  const numSteps = 1;
  const numChords = 8 * emotions.length;

  const chordSets = [
    ["C", "G", "Am", "F", "C", "G", "Am", "F"],
    ["Am", "Dm", "G", "C", "Am", "Dm", "G", "C"],
    ["Am", "F", "C", "G", "Am", "F", "C", "G"],
    ["C", "Am", "Dm", "G", "C", "Am", "Dm", "G"],
    ["C", "Eb", "F", "Ab", "C", "Eb", "F", "Ab"],
    ["Am", "Dm", "E", "Am", "Am", "Dm", "E", "Am"],
    ["Am", "E", "Am", "E", "Am", "E", "Am", "E"],
  ];

  const instNum = [
    //57, //trumpet
    13,
    //41, //violin
    41,
    72, //clarinet
    13, //marinba
    30, //overdriven guitar
    24, //tango accordion
    31, //distortion guitar
  ];

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

  async function generateChordProgressions(chordIndex, result) {
    if (chordIndex === numChords) {
      return result;
    } else {
      const seqs = await model.decode(
        zTensor,
        0,
        { chordProgression: [chords[chordIndex]] },
        STEPS_PER_QUARTER
      );
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
      emotions.forEach((emotion) => {
        setChords((prev) => [...prev, ...chordSets[emotion]]);
      });
    }
  }, [startLoading]);

  useEffect(() => {
    async function generateSample() {
      const z = tf.randomNormal([1, 4 * Z_DIM]);
      const zArray = await z.data();
      z.dispose();
      setZTensor(tf.tensor2d(zArray, [4, Z_DIM]));
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
      console.log("seq", seqs);
      const concatenatedSeqs = seqs.map((s) => concatenateSequences(s));
      console.log("con", concatenatedSeqs);
      setProgSeqs(
        concatenatedSeqs.map((seq) => {
          const mergedSeq = core.sequences.mergeInstruments(seq);
          //console.log("mer", mergedSeq);

          const progSeq = core.sequences.unquantizeSequence(mergedSeq);
          progSeq.ticksPerQuarter = STEPS_PER_QUARTER;
          //console.log("prog", progSeq);

          progSeq.notes.forEach((note) => {
            note.isDrum = false;
            if (note.pitch <= 40) {
              // If the pitch is between 24 and 40, set the instrument to bass
              note.instrument = 1;
              note.program = 32;
            } else {
              if (note.instrument % 2 == 0) {
                const noteBarIndex = Math.floor(note.startTime / 38.4);
                console.log(noteBarIndex);
                note.instrument = noteBarIndex + 2;
                note.program = instNum[emotions[noteBarIndex]];
              } else {
                note.instrument = 0;
                note.program = 0;
              }
            }
          });
          return progSeq;
        })
      );
    }
    if (zTensor) {
      generateProgressions();
    }
  }, [zTensor]);

  useEffect(() => {
    async function saveSequence() {
      console.log(progSeqs[0]);

      const midi = core.sequenceProtoToMidi(progSeqs[0]);
      const file = new Blob([midi], { type: "audio/midi" });
      try {
        const response = await fetch("/api/saveMidi", {
          method: "POST",
          body: JSON.stringify({ midi: midi }),
        });

        if (response.ok) {
          console.log(response.data);
          setProcessState(2);
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
      console.log(chords);
    }
  }, [progSeqs]);

  return <></>;
}
