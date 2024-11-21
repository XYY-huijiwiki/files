import { Octokit } from "octokit";
import { writeFileSync } from "fs";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

let releasesList = [];

while (true) {
  let { data } = await octokit.request("GET /repos/{owner}/{repo}/releases", {
    owner: "XYY-huijiwiki",
    repo: "files",
    per_page: 100,
    page: Math.ceil(releasesList.length / 100),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (data.length === 0) break;
  // remove useless data
  data = data.map((release) => {
    return {
      id: release.id,
      tag_name: release.tag_name,
      body: release.body,
      assets: release.assets.map((asset) => {
        return {
          id: asset.id,
          name: asset.name,
          size: asset.size,
          browser_download_url: asset.browser_download_url,
        };
      }),
    };
  });
  releasesList = releasesList.concat(data);
  console.log(releasesList.length);
}

// write result to file ./dist/releases.json
writeFileSync("./dist/releases.json", JSON.stringify(releasesList, null, 2));
