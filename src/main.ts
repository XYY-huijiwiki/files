import { Octokit } from "octokit";
import mime from "mime-types";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  readFileSync,
  copyFileSync,
} from "fs";
import generateThumbnail from "./generateThumbnail.js";

try {
  let dev = process.env.GITHUB_ACTIONS === undefined;
  let octokit = new Octokit({
    auth: dev ? "" : process.env.GITHUB_TOKEN,
  });

  const URLS = {
    ORIGIN_ASSETS:
      "https://api.github.com/repos/XYY-huijiwiki/files/releases/202273771/assets",
    ORIGIN_UPLOAD:
      "https://uploads.github.com/repos/XYY-huijiwiki/files/releases/202273771/assets{?name,label}",
    THUMBS_ASSETS:
      "https://api.github.com/repos/XYY-huijiwiki/files/releases/206099778/assets",
    THUMBS_UPLOAD:
      "https://uploads.github.com/repos/XYY-huijiwiki/files/releases/206099778/assets{?name,label}",
  };

  // get all origin assets
  const assets = await octokit.paginate(octokit.rest.repos.listReleaseAssets, {
    owner: "XYY-huijiwiki",
    repo: "files",
    release_id: 202273771,
    per_page: 500,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  // get all thumbs assets
  const thumbs = await octokit.paginate(octokit.rest.repos.listReleaseAssets, {
    owner: "XYY-huijiwiki",
    repo: "files",
    release_id: 206099778,
    per_page: 500,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  console.log(`Assets length: ${assets.length}`);
  console.log(`Thumbs length: ${thumbs.length}`);

  for (let index = 0; index < assets.length; index++) {
    const element = assets[index];
    console.log(`loop ${index + 1}/${assets.length}`);
    console.log(`Processing ${element.name}`);
    // STEP 1: skip existing files
    if (thumbs.find((x) => x.name === element.name)) {
      console.log(`Skipping ${element.name}`);
      continue;
    }

    // STEP 2: skip non-image or non-video files
    const fileMime = mime.lookup(element.name);
    if (
      !fileMime ||
      !(fileMime.startsWith("image/") || fileMime.startsWith("video/"))
    ) {
      console.log(`Skipping ${element.name} (${fileMime})`);
      continue;
    }

    // STEP 3: download file
    let fileBuffer = await (
      await fetch(element.browser_download_url)
    ).arrayBuffer();
    writeFileSync(`./${element.name}`, Buffer.from(fileBuffer));

    // STEP 4: generate thumbnail
    await generateThumbnail(`./${element.name}`);

    // STEP 5: upload thumbnail
    let thumbBuffer = readFileSync(`./thumbs/${element.name}`);
    let { data: gh_res } = await octokit.request(
      "POST https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
      {
        owner: "XYY-huijiwiki",
        repo: "files",
        release_id: 206099778,
        name: element.name,
        data: thumbBuffer,
        headers: {
          "Content-Type": "image/webp",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    console.log(gh_res);

    // STEP 6: clean up
    unlinkSync(`./${element.name}`);
    unlinkSync(`./thumbs/${element.name}`);
  }
} catch (err) {
  console.dir(err);
}
