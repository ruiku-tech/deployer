const broadcast = require("../../broadcast");

class RedEnvelopeRain {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.redRainPlay();
    await this.getRedRainRecord();
    await this.getUserPlayRedRain();
  }
  /** 玩红包雨 */
  async redRainPlay() {
    try {
      const data = await this.owner.get("玩红包雨", "/v1/redRain/play");
      if (!data.data.status == false) {
        broadcast.cast(`ERR:活动尚未开始`);
      } else if (data.data.canPlay == false) {
        broadcast.cast(`ERR:本轮已经玩过红包雨`);
      } else {
        broadcast.cast(`:玩红包雨验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:玩红包雨验证失败\n${JSON.stringify(error)}`);
    }
  }
  /** 获取红包雨配置 */
  async getRedRainRecord() {
    try {
      const data = await this.owner.get(
        "获取红包雨配置",
        "/v1/redRain/getRedRainRecord"
      );
      const redRainList = data.data.every((item) => "redRainList" in item);
      const totalAmount = data.data.every((item) => "totalAmount" in item);
      if (redRainList.lenght < 1) {
        broadcast.cast(`ERR:redRainList数据缺失`);
      } else if (!totalAmount) {
        broadcast.cast(`ERR:totalAmount字段缺失`);
      } else {
        broadcast.cast(`:获取红包雨配置验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取红包雨配置验证失败\n${JSON.stringify(error)}`);
    }
  }
  /** 获取用户本场是否玩过红包雨 */
  async getUserPlayRedRain() {
    try {
      const data = await this.owner.get(
        "获取用户本场是否玩过红包雨",
        "/v1/redRain/getUserPlayRedRain"
      );
      if (!data.data) {
        broadcast.cast(`ERR:无返回结果`);
      } else {
        broadcast.cast(
          `:获取用户本场是否玩过红包雨验证通过\n是否玩过:${data.data}`
        );
      }
    } catch (error) {
      broadcast.cast(
        `:获取用户本场是否玩过红包雨验证失败\n${JSON.stringify(error)}`
      );
    }
  }
}

module.exports = RedEnvelopeRain;
