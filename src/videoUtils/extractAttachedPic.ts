import { ffmpeg } from "../ffmpeg.js";

async function extractAttachedPic(
  inputPath: string,
  streamIndex: number,
  outputPath: string
): Promise<void> {
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-map",
        `0:${streamIndex}`,
        "-frames:v",
        "1",
        "-lossless",
        "1",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

export default extractAttachedPic;
