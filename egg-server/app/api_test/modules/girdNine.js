const broadcast = require("../../service/broadcast");

class GirdNine {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.queryUserCount();
    await this.popularizes();
    await this.getUserInviteUser();
    await this.receiveReward();
  }
  /** 查询用户次数 */
  async queryUserCount() {
    try {
      const data = await this.owner.get(
        "查询用户次数",
        "/v1/popularize/queryUserCount"
      );
      if (!data.data.curtAmount) {
        broadcast.cast(`ERR:curtAmount(已有金额)字段缺失`);
      } else if (!data.data.count) {
        broadcast.cast(`ERR:count缺失`);
      } else {
        broadcast.cast(
          `:查询用户次数验证通过\n金额${data.data.curtAmount},可玩次数${data.data.count}`
        );
      }
    } catch (error) {
      broadcast.cast(`:查询用户次数验证失败\n${JSON.stringify(error)}`);
    }
  }
  /** 玩九宫格 */
  async popularizes() {
    try {
      const data = await this.owner.get(
        "玩九宫格",
        "/v1/popularize/popularizes"
      );
      if (!data.data.addAmount) {
        broadcast.cast(`ERR:addAmount字段缺失`);
      } else if (!data.data.count) {
        broadcast.cast(`ERR:count缺失`);
      } else {
        broadcast.cast(
          `:玩九宫格验证通过\n增加金额${data.data.addAmount},可玩次数${data.data.count}`
        );
      }
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      broadcast.cast(`:玩九宫格验证失败\n${JSON.stringify(error)}`);
    }
  }
  /** 查询记录 */
  async getUserInviteUser() {
    try {
      const data = await this.owner.get(
        "查询记录",
        "/v1/popularize/getUserInviteUser"
      );
      const addAmount = data.data.every((item) => "addAmount" in item);
      const username = data.data.every((item) => "username" in item);
      if (!addAmount) {
        broadcast.cast(`ERR:addAmount字段缺失`);
      } else if (!username) {
        broadcast.cast(`ERR:username字段缺失`);
      } else {
        broadcast.cast(`:查询记录验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:查询记录失败\n${JSON.stringify(error)}`);
    }
  }
  /** 领取奖励 */
  async receiveReward() {
    try {
      const data = await this.owner.get(
        "领取奖励",
        "/v1/popularize/receiveReward"
      );
      broadcast.cast(`:领取奖励验证通过\n${JSON.stringify(data)}`);
    } catch (error) {
      if (error.data.code == 2022) {
        broadcast.cast(`:未满足条件`);
      } else {
        broadcast.cast(`:领取奖励失败\n${JSON.stringify(error)}`);
      }
    }
  }
}

module.exports = GirdNine;
