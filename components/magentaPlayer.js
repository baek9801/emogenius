import { useState, useEffect } from "react";

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
  const [mainSeq, setMainSeq] = useState(null);
  const [bgSeq, setBgSeq] = useState(null);
  const [chords, setChords] = useState([]);

  const STEPS_PER_QUARTER = 10;
  const Z_DIM = 256;

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
    67, //tenor sax(중립)
    41, //violin(슬픔)
    74, //flute(행복+슬픔)
    72, //clarinet(행복)
    30, //overdriven guitar(행복+화남)
    31, //distortion guitar(슬픔+화남)
    19, //rock organ(화남)
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

  async function generateChordProgressions(chordIndex, result, isMain) {
    if (chordIndex === numChords) {
      return result;
    } else {
      const seqs = await model.decode(
        zTensor,
        isMain ? 0.7 : 0,
        { chordProgression: [chords[chordIndex]] },
        STEPS_PER_QUARTER
      );
      result.push(seqs[0]);
      return generateChordProgressions(chordIndex + 1, result, isMain);
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
    async function generateProgressions({ isMain }) {
      const seq = await generateChordProgressions(0, [], isMain);
      const concatenatedSeq = concatenateSequences(seq);
      const mergedSeq = core.sequences.mergeInstruments(concatenatedSeq);
      const progSeq = core.sequences.unquantizeSequence(mergedSeq);
      progSeq.ticksPerQuarter = STEPS_PER_QUARTER;
      progSeq.notes.forEach((note) => {
        note.isDrum = false;
        if (note.pitch <= 40) {
          note.instrument = 1;
          note.program = 32;
        } else {
          if (isMain) {
            if (note.pitch <= 50) {
              note.instrument = -1;
            } else {
              const noteBarIndex = Math.floor(note.startTime / 38.4);
              note.instrument = noteBarIndex + 2;
              note.program = instNum[emotions[noteBarIndex]];
            }
          } else {
            note.instrument = 0;
            note.program = 0;
          }
        }
      });
      progSeq.notes.forEach((note) => {
        if (isMain) {
          note.isDrum = false;
          if (note.pitch <= 70) {
            note.instrument = -1;
          } else {
            const noteBarIndex = Math.floor(note.startTime / 38.4);
            console.log(noteBarIndex);
            note.instrument = noteBarIndex + 2;
            note.program = instNum[emotions[noteBarIndex]];
          }
        } else {
          if (note.pitch <= 40) {
            note.instrument = 1;
            note.program = 32;
          } else {
            note.instrument = 0;
            note.program = 0;
          }
        }
      });
      progSeq.notes = progSeq.notes.filter((note) => note.instrument !== -1);
      if (isMain) setMainSeq(progSeq);
      else setBgSeq(progSeq);
    }
    if (zTensor) {
      generateProgressions({ isMain: true });
      generateProgressions({ isMain: false });
    }
  }, [zTensor]);

  useEffect(() => {
    async function saveSequence() {
      bgSeq.notes.forEach((note) => {
        mainSeq.notes.push(note);
      });

      const midi = core.sequenceProtoToMidi(mainSeq);
      try {
        const response = await fetch("/api/midiToWav", {
          method: "POST",
          body: JSON.stringify({ midi: midi }),
        });

        if (response.ok) {
          setProcessState(2);
          console.log("MIDI file saved successfully");
        } else {
          console.error("Failed to save MIDI file");
        }
      } catch (error) {
        console.error("Failed to save MIDI file", error);
      }
    }
    if (mainSeq && bgSeq) {
      saveSequence();
    }
  }, [mainSeq, bgSeq]);

  return <></>;
}
