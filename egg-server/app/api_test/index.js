const axios = require("axios");
const qs = require("querystring");
const crypto = require("crypto");
const broadcast = require("../service/broadcast");
console.log("怎么回事");
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
const GameHistory = require("./modules/gameHistory");
const Wallet = require("./modules/wallet");
const WS = require("./modules/webSocket");
const GirdNine = require("./modules/girdNine");
const Originais = require("./modules/originais");
const Wheel = require("./modules/wheel");
const RedEnvelopeRain = require("./modules/redEnvelopeRain");
const Cashback = require("./modules/cashback");
const ReentryReward = require("./modules/reentryReward");
const Referee = require("./modules/referee");
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
    new Wheel(this);
    // new User(this);
    // new WS(this);
    // new GameHistory(this);
    new Wallet(this);
    // new GirdNine(this);
    // new Originais(this);
    // new RedEnvelopeRain(this);
    // new Cashback(this);
    // new ReentryReward(this);
    // new Referee(this);
  }

  /**注册 */
  register(module) {
    this.modules.push(module);
  }
  updateHeader(key, value) {
    this.headers[key] = value;
  }
  updateData(key, value) {
    this.data[key] = value;
  }

  async post(name, route, params) {
    const url = `http://${this.config.host}${this.config.prefix}${route}`;
    try {
      broadcast.cast(`:开始验证：${name}`);
      const resp = await axios.post(url, params, {
        headers: {
          ...this.headers,
          sign: generateSign(),
          // auth: this.data["freshToken"],
        },
      });
      if (resp.data.code === 200) {
        return resp.data;
      } else {
        broadcast.cast(`:验证异常：${name}(${route}),${resp.data.code}`);
        return Promise.reject(resp.data);
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
        headers: {
          ...this.headers,
          sign: generateSign(),
          // auth: this.data["freshToken"],
        },
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
    try {
      for (let index = 0; index < this.modules.length; index++) {
        const element = this.modules[index];
        await element.start();
      }
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = ApiTester;
