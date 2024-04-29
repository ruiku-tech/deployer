const broadcast = require("../../broadcast");

class ReentryReward {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.getRechargeReward();
  }
  /** 获取用户是否为老玩家 */
  async getRechargeReward() {
    try {
      const data = await this.owner.get(
        "获取用户是否为老玩家",
        "/v1/user/getRechargeReward"
      );
      console.log(data);
      if (!data.data) {
        broadcast.cast(`ERR:该用户并非老玩家`);
      } else if (data.data.canPlay == false) {
        broadcast.cast(`ERR:本轮已经玩过红包雨`);
      } else {
        broadcast.cast(`:获取用户是否为老玩家验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取用户是否为老玩家验证失败\n${JSON.stringify(error)}`);
    }
  }
}

module.exports = ReentryReward;
