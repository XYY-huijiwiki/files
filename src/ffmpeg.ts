import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { promisify } from "util";

// Configure ffmpeg paths
// @ts-ignore
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);
const probe = promisify(ffmpeg.ffprobe);

export { probe, ffmpeg };
