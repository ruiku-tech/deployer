const axios = require("axios");
const qs = require("querystring");
const crypto = require("crypto");
const broadcast = require("../broadcast");

function generateSign() {
  const serverTime = Date.now();
  const hash = crypto.createHash("sha256");
  hash.update(serverTime + "aq6nJGnzLyrqI1HZl").toString("hex");
  const sign = hash.digest("hex") + "-" + Date.now().toString(16);
  return sign;
}

// 引入各个模块
const Website = require("./modules/website");
const User = require("./modules/user");

class ApiTester {
  headers = {};
  data = {};
  modules = [];
  // config: host,prefix
  // 如host: 12.12.12.123:81
  // 如prefix: /api ，需要这个参数的原因是在无感升级的时候，会部署备用服，还没有转发规则
  constructor(config) {
    this.config = config;
    new Website(this);
    new User(this);
  }

  /**注册 */
  register(module) {
    this.modules.push(module);
  }
  updateHeader(key, value) {
    this.headers[key] = value;
  }
  updateData(key, value){
    this.data[key] = value;
  }

  async post(name, route, params) {
    const url = `http://${this.config.host}${this.config.prefix}${route}`;
    try {
      broadcast.cast(`:开始验证：${name}`);
      const resp = await axios.post(url, params, {
        Headers: { ...this.headers, sign: generateSign() },
      });
      if (resp.data.code === 200) {
        return resp.data;
      } else {
        broadcast.cast(`:验证异常：${name}(${route}),${resp.data.code}`);
        return Promise.reject({
          message: `${name}响应异常:${resp.data.code}`,
          data: resp.data,
        });
      }
    } catch (error) {
      broadcast.cast(`ERR:验证异常：${name}(${route}),${error.message}`);
      return Promise.reject(error);
    }
  }
  async get(name, route, query) {
    const url = `http://${this.config.host}${this.config.prefix}${route}`;
    try {
      broadcast.cast(`:开始验证：${name}`);
      const resp = await axios.get(`${url}?${qs.stringify(query)}`, {
        Headers: { ...this.headers, sign: generateSign() },
      });
      if (resp.data.code === 200) {
        return resp.data;
      } else {
        return Promise.reject({
          message: `${name}响应异常:${resp.data.code}`,
          data: resp.data,
        });
      }
    } catch (error) {
      broadcast.cast(`ERR:验证异常：${name},${error.message}`);
      return Promise.reject(error);
    }
  }

  async run() {
    for (let index = 0; index < this.modules.length; index++) {
      const element = this.modules[index];
      await element.start();
    }
  }
}

module.exports = ApiTester;
