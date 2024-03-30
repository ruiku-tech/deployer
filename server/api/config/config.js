const http = require("http");
const crypto = require("crypto");
const querystring = require("querystring");
const broadcast = require("../../broadcast");
//接口方法
function makeHttpRequest(options, requestData) {
  return new Promise((resolve, reject) => {
    if (requestData) {
      if (requestData.param) {
        options.path = `${options.path}?${querystring.stringify(
          requestData.param
        )}`;
      }
    }
    options.headers.sign = generateSign();
    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        let response = JSON.parse(responseData);
        if (response.code == 200) {
          broadcast.cast(`:${requestData.name}:成功`);
        } else {
          broadcast.cast(
            `:${requestData.name}:\n${responseFormat(responseData)}`
          );
        }
        resolve(responseData);
      });
    });

    req.on("error", (error) => {
      broadcast.cast(`:${requestData.name}，错误信息:`, error);
    });
    if (requestData?.json) {
      req.write(JSON.stringify(requestData.json));
    }
    req.end();
  });
}
//生成手机号
function generateRandomNumber() {
  // 生成8位随机数
  var randomNumber = Math.floor(Math.random() * 100000000);
  // 将生成的随机数转换为字符串
  var randomNumberString = randomNumber.toString();
  // 如果随机数不满足8位，则在前面添加0，使之满足8位
  while (randomNumberString.length < 8) {
    randomNumberString = "0" + randomNumberString;
  }
  // 以 "009" 开头并拼接生成的8位随机数
  var result = "009" + randomNumberString;
  return result;
}
//生成sign
function generateSign() {
  const serverTime = Date.now();
  const hash = crypto.createHash("sha256");
  hash.update(serverTime + "aq6nJGnzLyrqI1HZl").toString("hex");
  const sign = hash.digest("hex") + "-" + Date.now().toString(16);
  return sign;
}
function compose(...functions) {
  return functions.reduce((promiseChain, currentFunction) => {
    return promiseChain.then(() => currentFunction());
  }, Promise.resolve());
}
// const compose = async (...funcs) => {
//   for (let index = 0; index < funcs.length; index++) {
//     await funcs[index]();
//   }
// };

let options = {
  hostname: "",
  port: 80,
  path: "",
  method: "",
  headers: {
    "Content-Type": "application/json",
    sign: generateSign(),
  },
};
function configOptions(path, method) {
  if (method == "POST") {
    if (!options.headers["Content-Type"]) {
      options.headers["Content-Type"] = "application/json";
    }
  } else if (method == "GET") {
    if (options.headers["Content-Type"]) {
      delete options.headers["Content-Type"];
    }
  }
  options.path = `/api${path}`;
  options.method = method;
  return options;
}
function responseFormat(response) {
  let responseObject;
  try {
    responseObject = JSON.parse(response);
  } catch (error) {
    return response;
  }
  const formattedResponse = JSON.stringify(responseObject, null, 2);
  return formattedResponse;
}
module.exports = {
  options: options,
  makeHttpRequest: makeHttpRequest,
  generateRandomNumber: generateRandomNumber,
  generateSign: generateSign,
  configOptions: configOptions,
  responseFormat: responseFormat,
  compose: compose,
};
