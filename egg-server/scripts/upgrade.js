const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios").default;

/**
 * 自动升级脚本
 * 
 * 安全性说明：
 * 1. 此脚本作为独立的子进程运行（通过 spawn 的 detached: true 选项）
 * 2. 即使父进程（egg 服务）被 npm run stop 终止，此脚本仍会继续运行
 * 3. detached 进程会完全独立于父进程的生命周期
 * 4. stdio: 'ignore' 确保子进程不依赖父进程的输入输出流
 * 5. unref() 让父进程不等待子进程，避免阻塞
 * 
 * 升级流程：
 * 下载 -> 停止服务 -> 解压更新 -> 安装依赖 -> 启动服务
 */

const url = "https://api.github.com/repos/ruiku-tech/deployer/releases/latest";

// 配置路径（根据实际部署路径调整）
const localPath = "/tmp/deployer-release.zip";
const projectDir = path.resolve(__dirname, "..");

console.log("开始自动升级流程...");
console.log("项目目录:", projectDir);

// 仓库现在是公开的，无需token
axios
  .get(url)
  .then((resp) => {
    const downloadUrl =
      resp.data.assets.length > 0
        ? resp.data.assets[0].browser_download_url
        : null;
    
    if (!downloadUrl) {
      console.log("未找到发布文件");
      return;
    }

    console.log("最新版本:", resp.data.tag_name);
    console.log("下载地址:", downloadUrl);
    console.log("正在下载...");

    // 步骤1: 下载发布文件
    exec(`wget -O ${localPath} ${downloadUrl}`, (error, stdout, stderr) => {
      if (error) {
        console.log("下载发布文件失败:", error.message);
        return;
      }
      console.log("下载完成，开始停止服务...");

      // 步骤2: 停止服务
      exec("npm run stop", { cwd: projectDir }, (error, stdout, stderr) => {
        if (error) {
          console.log("停止服务警告:", error.message);
          // 即使停止失败也继续，可能服务本来就没运行
        }
        console.log("服务已停止，开始解压更新文件...");

        // 步骤3: 解压文件（覆盖现有文件）
        const command = `unzip -o ${localPath} -d ${projectDir}`;
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.log("解压失败:", error.message);
            return;
          }
          console.log("解压完成，安装依赖...");

          // 步骤4: 安装依赖
          exec("npm install --production", { cwd: projectDir }, (error, stdout, stderr) => {
            if (error) {
              console.log("安装依赖失败:", error.message);
              // 即使失败也尝试启动
            }
            console.log("依赖安装完成，启动服务...");

            // 步骤5: 启动服务
            exec("npm run start", { cwd: projectDir }, (error, stdout, stderr) => {
              if (error) {
                console.log("启动服务失败:", error.message);
                console.log("请手动执行: cd", projectDir, "&& npm run start");
                return;
              }
              console.log("服务启动成功！");
              console.log("升级完成，版本:", resp.data.tag_name);

              // 清理下载的zip文件
              fs.unlink(localPath, (err) => {
                if (err) console.log("清理临时文件失败", err.message);
              });
            });
          });
        });
      });
    });
  })
  .catch((error) => {
    console.log("升级失败:", error.message);
    if (error.response) {
      console.log("响应状态:", error.response.status);
      console.log("响应数据:", error.response.data);
    }
  });
