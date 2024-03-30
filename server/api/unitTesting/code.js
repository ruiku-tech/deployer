const http = require("http");
const crypto = require("crypto");
const querystring = require("querystring");
const broadcast = require("../../broadcast");
//接口方法
function makeHttpRequest(options, requestData) {
  return new Promise((resolve, reject) => {
    if (options.method == "GET") {
      options.path = `${options.path}?${querystring.stringify(requestData)}`;
    }
    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        resolve(responseData);
      });
    });

    req.on("error", (error) => {
      reject(error);
    });
    if (options.method == "POST") {
      req.write(JSON.stringify(requestData));
    }
    req.end();
  });
}
//生成sign
function generateSign() {
  const serverTime = Date.now();
  const hash = crypto.createHash("sha256");
  hash.update(serverTime + "aq6nJGnzLyrqI1HZl").toString("hex");
  const sign = hash.digest("hex") + "-" + Date.now().toString(16);
  return sign;
}
function options(path, method) {
  return {
    hostname: "43.133.227.48",
    port: 80,
    path: path,
    method: method,
    headers: {
      "Content-Type": "application/json",
      sign: generateSign(),
    },
  };
}
function responseFormat(response) {
  const responseObject = JSON.parse(response);
  const formattedResponse = JSON.stringify(responseObject, null, 2);
  return formattedResponse;
}
//忘记密码

// 创建一个输入流
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 提示用户输入值
readline.question("请输入邮箱：", (email) => {
  // 发送邮件
  const getCodeReq = {
    email: email,
    type: 1,
  };
  // 打印用户输入的值
  makeHttpRequest(options("/api/v1/global/getCode", "GET"), getCodeReq)
    .then((response) => {
      broadcast.cast(`发送邮件:\n${responseFormat(response)}`);
      const responseObject = JSON.parse(response);
      if (responseObject.code == 200) {
        // 创建一个输入流
        const readline = require("readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        readline.question("请输入验证码：", (code) => {
          const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const ForgetPasswordReq = {
            email: email,
            code: code,
            newPassword: "Ss141242",
          };
          makeHttpRequest(
            options("/api/v1/user/forgetPassword", "POST"),
            ForgetPasswordReq
          )
            .then((response) => {
              broadcast.cast(`修改密码:\n${responseFormat(response)}`);
            })
            .catch((error) => {
              console.error("修改密码失败，错误信息:", error);
            });
          // 关闭输入流
          readline.close();
        });
      }
    })
    .catch((error) => {
      console.error("发送邮件失败，错误信息:", error);
    });

  // 关闭输入流
  readline.close();
});
