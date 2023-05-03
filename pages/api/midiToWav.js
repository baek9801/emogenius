import fs from "fs";
import { promisify } from "util";
import { join } from "path";
import { exec } from "child_process";

const writeFile = promisify(fs.writeFile);

function objectToArrayBuffer(obj) {
  const keyValuePairs = Object.entries(obj).map(([key, value]) => [
    parseInt(key, 10),
    value,
  ]);
  keyValuePairs.sort((a, b) => a[0] - b[0]);
  const uint8Array = new Uint8Array(keyValuePairs.map(([, value]) => value));
  return uint8Array.buffer;
}

function convertMidiToWav(midiFilePath, soundFontFilePath, outputWavFilePath) {
  return new Promise((resolve, reject) => {
    const command = `fluidsynth -ni ${soundFontFilePath} ${midiFilePath} -F ${outputWavFilePath} -r 44100`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

export default async function midiToWavHandler(req, res) {
  if (req.method === "POST") {
    try {
      const midiData = JSON.parse(req.body).midi;
      const publicPath = join(process.cwd(), "public");
      const filePath = join(publicPath, "prog.mid");

      const midiFilePath = "public/prog.mid";
      const soundFontFilePath = "public/SGM-V2.01.sf2"; //file is too large to upload to GitHub
      const outputWavFilePath = "public/prog.wav";

      await writeFile(
        filePath,
        Buffer.from(objectToArrayBuffer(midiData)),
        "binary"
      ).then(
        convertMidiToWav(midiFilePath, soundFontFilePath, outputWavFilePath)
      );

      res.status(200).json({ message: "MIDI file saved successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Failed to save MIDI file" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
