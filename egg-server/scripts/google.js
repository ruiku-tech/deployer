const speakeasy = require("speakeasy");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require('crypto');

function setEnvVariable(varName, value) {
  // 获取用户主目录并定位 .bashrc 文件
  const bashrcPath = path.join(os.homedir(), ".bashrc");

  // 要写入的环境变量内容
  const envLine = `export ${varName}="${value}"\n`;

  // 检查 .bashrc 中是否已有该环境变量
  fs.readFile(bashrcPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading .bashrc:", err);
      return;
    }

    // 正则检查环境变量是否已存在
    const regex = new RegExp(`^export\\s+${varName}=`, "m");
    if (regex.test(data)) {
      console.log(`Environment variable ${varName} already exists.`);
    } else {
      // 追加新的环境变量
      fs.appendFile(bashrcPath, envLine, (err) => {
        if (err) {
          console.error("Error writing to .bashrc:", err);
        } else {
          console.log(`Environment variable ${varName} added to .bashrc.`);
        }
      });
    }
  });
}
const googlekey = process.env.DEPLOY_KEY;
if (googlekey) {
  console.log("谷歌密钥:", googlekey);
} else {
  const secret = speakeasy.generateSecret({
    length: 20, // 密钥长度
    name: "deployer", // 应用名称，用户扫描二维码时可以看到
  });
  if(secret){
    // 使用示例
    setEnvVariable("DEPLOY_KEY", secret.base32);
    console.log("谷歌密钥:", secret);
  }else{
    process.exit(1)
    console.log("谷歌生成失败:", secret);
  }
}
const jwtkey = process.env.DEPLOY_JWT;
if(!jwtkey){
  setEnvVariable("DEPLOY_JWT", crypto.randomBytes(32).toString("hex"));
}