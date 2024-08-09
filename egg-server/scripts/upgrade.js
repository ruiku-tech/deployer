const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios").default;

const url = `https://github.com/ruiku-tech/deployer/releases/latest`;

const localPath = "/usr/release.zip";
const outputDir = "/usr/egg-server";

/**2025.08.09 */
const token = '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'

axios
  .get(url, {
    headers: {
      Authorization:
        `token ${token}`,
    },
  })
  .then((resp) => {
    const downloadUrl =
      resp.data.assets.length > 0
        ? resp.data.assets[0].browser_download_url
        : null;
    if (downloadUrl) {
      exec(`sudo wget --header="Authorization: token ${token}" -O ${localPath} ${downloadUrl}`, (error) => {
        if (error) {
          console.log("下载发布文件失败", error);
          return;
        }
        const command = `unzip -o ${localPath} -d ${outputDir}`;
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.log("解压失败", error.message);
            return;
          }
          console.log("更新成功");
        });
      });
    }
  })
  .catch((error) => {
    console.log("升级失败", error.message);
  });
