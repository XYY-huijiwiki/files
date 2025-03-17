import { parse } from "path";
import { ffmpeg, probe } from "./ffmpeg.js";
import { fileTypeFromFile } from "file-type";
import { renameSync, existsSync, mkdirSync } from "fs";
import extractAttachedPic from "./videoUtils/extractAttachedPic.js";
import extractBestFrame from "./videoUtils/extractBestFrame.js";

interface VideoMetadata {
  streams: Array<{
    index: number;
    codec_type: string;
    disposition: { [key: string]: number };
  }>;
}

interface ImageMetadata {
  streams: Array<{
    width: number;
    height: number;
  }>;
}

async function generateThumbnail(inputPath: string): Promise<void> {
  // prepare `thumbs` folder
  if (!existsSync("./thumbs")) {
    mkdirSync("./thumbs");
  }

  const fileType = await fileTypeFromFile(inputPath);
  if (!fileType) throw new Error("Unsupported file type");

  const isVideo = fileType.mime.startsWith("video/");
  const outputPathTemp = `./thumbs/${parse(inputPath).name}.webp`;

  if (isVideo) {
    console.log("Processing video:", inputPath);
    await processVideo(inputPath, outputPathTemp);
  } else {
    console.log("Processing image:", inputPath);
    await convertToWebp(inputPath, outputPathTemp);
  }

  renameSync(
    `./thumbs/${parse(inputPath).name}.webp`,
    `./thumbs/${parse(inputPath).name}${parse(inputPath).ext}`
  );
}

async function processVideo(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const metadata = (await probe(inputPath)) as VideoMetadata;
  const attachedPicStream = metadata.streams.find(
    (s) => s.codec_type === "video" && s.disposition?.attached_pic === 1
  );

  if (attachedPicStream) {
    console.log("Extracting attached picture");
    await extractAttachedPic(inputPath, attachedPicStream.index, outputPath);
  } else {
    console.log("Extracting best frame");
    await extractBestFrame(inputPath, outputPath);
  }
}

async function convertToWebp(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const { width, height } = ((await probe(inputPath)) as ImageMetadata)
    .streams[0];
  const targetSize = Math.min(width, height, 1080);
  const targetSide = width < height ? "w" : "h";
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `scale=${targetSide === "w" ? targetSize : "-1"}:${
          targetSide === "h" ? targetSize : "-1"
        }:force_original_aspect_ratio=decrease`,
        "-c:v",
        "libwebp",
        "-lossless",
        "1",
        "-preset",
        "default",
        "-compression_level",
        "6",
        "-loop",
        "0",
        "-an",
      ])
      .output(outputPath)
      .on("start", (commandLine) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

export default generateThumbnail;
