// 站点配置模块

const broadcast = require("../../broadcast");

class Website {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.webConfig();
  }
  async webConfig() {
    try {
      const data = await this.owner.get(
        "站点配置",
        "/v1/global/getCurrencyAndNetwork"
      );
      if (data.data.cryptoNetworks.length < 1) {
        broadcast.cast(`ERR:站点配置网络列表缺失`);
        return Promise.reject(error);
      }
      if (data.data.cryptoCurrencies.length < 1) {
        broadcast.cast(`ERR:站点配置货币列表缺失`);
        return Promise.reject(error);
      }
      if (data.data.levelConfigs.length < 1) {
        broadcast.cast(`ERR:站点配置等级列表缺失`);
        return Promise.reject(error);
      }
      if (!data.data.profitRate) {
        broadcast.cast(`ERR:站点配置profitRate缺失`);
        return Promise.reject(error);
      }
      if (!data.data.time) {
        broadcast.cast(`ERR:站点配置time缺失`);
        return Promise.reject(error);
      }
      broadcast.cast(`:站点配置验证成功`);
    } catch (error) {
      // 站点配置获取失败，后面就不用验证了
      return Promise.reject(error);
    }
  }
}

module.exports = Website;
