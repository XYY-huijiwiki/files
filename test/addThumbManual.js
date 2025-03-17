import { Octokit } from "octokit";
import { readFileSync } from "node:fs";

let octokit = new Octokit({
  auth: "",
});
let thumbBuffer = readFileSync(
  `8YyHl7AKljSjqwZYB8wwirBXc61aGA8tTJg6QzmWb7S2fD05WZIYlJCId08KHuFgY7res5Ez0.glb`
);
let { data: gh_res } = await octokit.request(
  "POST https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
  {
    owner: "XYY-huijiwiki",
    repo: "files",
    release_id: 206099778,
    name: `8YyHl7AKljSjqwZYB8wwirBXc61aGA8tTJg6QzmWb7S2fD05WZIYlJCId08KHuFgY7res5Ez0.glb`,
    data: thumbBuffer,
    headers: {
      "Content-Type": "image/png",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  }
);
console.log(gh_res);
