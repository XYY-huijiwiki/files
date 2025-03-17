import { ffmpeg } from "../ffmpeg.js";

async function extractBestFrame(
  inputPath: string,
  outputPath: string
): Promise<void> {
  // Configuration parameters
  const BLACK_THRESHOLD = 32; // Pixel brightness threshold (0-255)
  const BLACK_PERCENTAGE = 90; // Percentage of dark pixels to consider frame black

  let foundFrame: number = 0;
  let isFirstCheck: boolean = true;

  // Phase 1: Find the first non-black frame using FFmpeg's blackframe filter
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `blackframe=${BLACK_THRESHOLD}:${BLACK_PERCENTAGE},metadata=print:file=-`,
        "-f",
        "null", // Discard output
        "-lossless",
        "1",
      ])
      .output("NUL")
      .on("stderr", (stderrLine: string) => {
        // Parse FFmpeg output to find the first non-black frame
        const frameMatch = stderrLine.match(/frame:(\d+)/);
        const blackMatch = stderrLine.match(/pblack:(\d+)/);
        const last_keyframeMatch = stderrLine.match(/last_keyframe:(\d+)/);

        if (frameMatch && blackMatch && last_keyframeMatch) {
          const last_keyframe = parseInt(last_keyframeMatch[1], 10);
          const frameNumber = parseInt(frameMatch[1], 10);
          const blackPercentage = parseInt(blackMatch[1], 10);

          // if the first frame is not black
          if (isFirstCheck && last_keyframe !== 0) {
            foundFrame = 0;
            resolve();
          } else if (isFirstCheck && last_keyframe === 0) {
            isFirstCheck = false;
          } else if (blackPercentage < BLACK_PERCENTAGE) {
            foundFrame = frameNumber;
            resolve(); // Stop processing once the first valid frame is found
          }
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        console.log("err");
        reject(err);
      })
      .run();
  });

  // Phase 2: Extract the identified frame
  console.log(`Extracting frame ${foundFrame}`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .outputOptions(["-vf", `select=eq(n\\,${foundFrame})`, "-vframes", "1"])
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        reject(err);
      })
      .run();
  });
}

export default extractBestFrame;
