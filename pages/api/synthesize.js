import nextConnect from "next-connect";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";

ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ storage: multer.memoryStorage() });

async function waitForFile(filePath, timeout) {
  try {
    await fsPromises.access(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`File not found. Waiting for ${timeout}ms...`);
      await new Promise((resolve) => setTimeout(resolve, timeout));
      return waitForFile(filePath, timeout);
    }
    throw error;
  }
}

const synthesizeHandler = nextConnect()
  .use(upload.single("video"))
  .post(async (req, res) => {
    try {
      if (!req.file) {
        throw new Error("No video file uploaded");
      }

      const videoInputBuffer = req.file.buffer;
      const outputFileName = `output_${req.file.originalname}`;
      const tempVideoInputFile = join(tmpdir(), req.file.originalname);
      const tempAudioInputFile = join(process.cwd(), "public", "prog.wav");
      await waitForFile(tempAudioInputFile, 1000);

      const tempOutputFile = join(tmpdir(), outputFileName);
      const tempMidiFile = join(process.cwd(), "public", "prog.mid");

      await fsPromises.writeFile(tempVideoInputFile, videoInputBuffer);

      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoInputFile)
          .input(tempAudioInputFile)
          .outputOptions("-c:v copy")
          .outputOptions("-c:a aac")
          .outputOptions("-map 0:v:0")
          .outputOptions("-map 0:a:0")
          .outputOptions("-map 1:a:0")
          .outputOptions(
            "-filter_complex [1:a]atempo=1.25[audio_stretched];[0:a]volume=0.3[original];[audio_stretched][original]amerge=inputs=2[a]"
          )
          .outputOptions("-map [a]")
          .save(tempOutputFile)
          .on("error", (err) => {
            console.error("FFmpeg error: ", err);
            reject(err);
          })
          .on("end", () => {
            console.log("FFmpeg: Successfully processed video");
            resolve();
          });
      });

      const outputBuffer = await fsPromises.readFile(tempOutputFile);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${outputFileName}`
      );
      res.setHeader("Content-Type", "video/mp4");
      res.send(outputBuffer);

      await Promise.all([
        fsPromises.unlink(tempVideoInputFile),
        fsPromises.unlink(tempAudioInputFile),
        fsPromises.unlink(tempOutputFile),
        fsPromises.unlink(tempMidiFile),
      ]);
    } catch (error) {
      console.error("Error: ", error.message);
      res.status(500).send("An error occurred during the file upload");
    }
  });

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default synthesizeHandler;
