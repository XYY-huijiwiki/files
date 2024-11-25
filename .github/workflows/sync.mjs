import { Octokit } from "octokit";
import mime from "mime";
import Sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  readFileSync,
  copyFileSync,
} from "fs";

let dev = process.env.GITHUB_ACTIONS === undefined;
let octokit = new Octokit({
  auth: dev ? "" : process.env.GITHUB_TOKEN,
});
let releasesList = [];

while (true) {
  let { data } = await octokit.request("GET /repos/{owner}/{repo}/releases", {
    owner: "XYY-huijiwiki",
    repo: "files",
    per_page: dev ? 1 : 100,
    page: dev ? 445 : Math.ceil(releasesList.length / 100),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  // remove useless data
  let data_temp = data.map((release) => {
    return {
      id: release.id,
      tag_name: release.tag_name,
      html_url: release.html_url,
      body: release.body,
      assets: release.assets.map((asset) => {
        return {
          id: asset.id,
          name: asset.name,
          size: asset.size,
          browser_download_url: asset.browser_download_url,
          updated_at: asset.updated_at,
          uploader: asset.uploader,
        };
      }),
    };
  });
  releasesList = releasesList.concat(data_temp);
  if (data.length === 0 || dev) break;
}

// ======== assets format check ======== //
for (let index = 0; index < releasesList.length; index++) {
  const element = releasesList[index];
  const assetNames = [
    element.assets[0]?.name.split(".")[0],
    element.assets[1]?.name.split(".")[0],
  ];
  let assets_broken = true;
  if (element.assets.length === 0) {
    console.warn(`[assets format] No asset for ${element.tag_name}`);
  } else if (element.assets.length === 1 && !assetNames.includes("default")) {
    console.warn(
      `[assets format] incorrect file name for origin file: ${element.tag_name}`
    );
  } else if (
    element.assets.length === 2 &&
    !(assetNames.includes("default") && assetNames.includes("thumb"))
  ) {
    console.warn(
      `[assets format] incorrect file name for origin file or thumb file: ${element.tag_name}`
    );
  } else if (element.assets.length > 2) {
    console.warn(`[assets format] More than 2 assets for ${element.tag_name}`);
  } else {
    assets_broken = false;
  }
  releasesList.filter((e) => e.id === element.id)[0].assets_broken =
    assets_broken;
}

// ======== generate thumbnails ======== //
for (let index = 0; index < releasesList.length; index++) {
  const element = releasesList[index];
  if (element.assets.length !== 1) continue; // if the number of assets is not 1, it's either no asset or has already a thumbnail
  let file_type = mime.getType(element.tag_name)?.split("/")[0];
  if (file_type === "image") await genImageThumb(element);
  if (file_type === "video") await genVideoThumb(element);
}
async function genImageThumb(element) {
  console.log(
    `Generating thumbnail for ${element.tag_name} (${element.html_url})`
  );
  let fileBuffer = await (
    await fetch(
      (dev ? "https://ghproxy.net/" : "") +
        element.assets[0].browser_download_url
    )
  ).arrayBuffer();
  let thumbBuffer = await Sharp(Buffer.from(fileBuffer), {
    failOn: "error",
    limitInputPixels: 0,
  })
    .resize({ height: 240 })
    .webp()
    .toBuffer();
  let { data: gh_res } = await octokit.request(
    "POST https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name={name}",
    {
      owner: "XYY-huijiwiki",
      repo: "files",
      release_id: element.id,
      name: "thumb.webp",
      data: thumbBuffer,
      headers: {
        "Content-Type": "image/webp",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  releasesList
    .filter((e) => e.id === element.id)[0]
    .assets.push({
      id: gh_res.id,
      name: gh_res.name,
      size: gh_res.size,
      browser_download_url: gh_res.browser_download_url,
    });
}
async function genVideoThumb(element) {
  console.log(
    `Generating thumbnail for ${element.tag_name} (${element.html_url})`
  );
  let currentTime = new Date().getTime();
  let fileBuffer = await (
    await fetch(
      (dev ? "https://ghproxy.net/" : "") +
        element.assets[0].browser_download_url
    )
  ).arrayBuffer();
  writeFileSync(`${currentTime}.mp4`, Buffer.from(fileBuffer));
  // check if cover img exists inside the video
  await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(`${currentTime}.mp4`, (err, metadata) => {
      if (err) reject(err);
      if (metadata.streams.some((stream) => stream.disposition?.attached_pic)) {
        let coverImgStreamIndex = metadata.streams.findIndex(
          (stream) => stream.disposition?.attached_pic
        );
        ffmpeg(`${currentTime}.mp4`)
          .outputOptions([
            `-map 0:${coverImgStreamIndex}`,
            "-c copy",
            "-f image2",
            "-frames:v 1",
          ])
          .output(`${currentTime}.png`)
          .on("end", resolve)
          .on("error", reject)
          .run();
      } else {
        ffmpeg(`${currentTime}.mp4`)
          .thumbnail({
            timestamps: [0],
            filename: `${currentTime}.png`,
          })
          .on("end", resolve)
          .on("error", reject);
      }
    });
  });
  let imageBuffer = readFileSync(`${currentTime}.png`);
  let thumbBuffer = await Sharp(imageBuffer, {
    failOn: "error",
    limitInputPixels: 0,
  })
    .resize({ height: 240 })
    .webp()
    .toBuffer();
  let { data: gh_res } = await octokit.request(
    "POST https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name={name}",
    {
      owner: "XYY-huijiwiki",
      repo: "files",
      release_id: element.id,
      name: "thumb.webp",
      data: thumbBuffer,
      headers: {
        "Content-Type": "image/webp",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  releasesList
    .filter((e) => e.id === element.id)[0]
    .assets.push({
      id: gh_res.id,
      name: gh_res.name,
      size: gh_res.size,
      browser_download_url: gh_res.browser_download_url,
    });
}

// ======== generate info json ======== //
// write result to file ./dist/releases.json
writeFileSync("./releases.json", JSON.stringify(releasesList, null, 2));

// create a new folder `dist`
if (!existsSync("./dist")) {
  mkdirSync("./dist");
}
// move releases.json and index.html to dist
renameSync("./releases.json", "./dist/releases.json");
copyFileSync("./index.html", "./dist/index.html");
