const broadcast = require("../../broadcast");

class Wheel {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.playGameWheel();
    await this.getTunTableTime();
    await this.getTurntableRecord();
  }
  /** 获取中奖值 */
  async playGameWheel() {
    const playGameWheelReq = {
      name: "获取中奖值",
      json: {
        gameId: 2,
      },
    };
    try {
      const data = await this.owner.post(
        playGameWheelReq.name,
        "/v1/userPlay/playGame?gameId=2",
        playGameWheelReq.json
      );
      if (!data.data) {
        broadcast.cast(`ERR:无返回结果`);
      } else {
        broadcast.cast(`:${playGameWheelReq.name}验证通过`);
      }
    } catch (error) {
      if (error.code == 20012) {
        broadcast.cast(`ERR:已转过转盘`);
      }
    }
  }
  /** 获取转盘时间 */
  async getTunTableTime() {
    try {
      const data = await this.owner.get(
        "获取转盘时间",
        "/v1/user/getTunTableTime"
      );
      if (!data.data) {
        broadcast.cast(`:结果无时间返回\n${JSON.stringify(data)}`);
      } else {
        broadcast.cast(`:获取转盘时间验证通过`);
      }
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
  /** 获取转盘奖励数据 */
  async getTurntableRecord() {
    const getAwardReq = {
      name: "获取转盘奖励数据",
      param: {
        id: 0,
        limit: "30",
      },
    };
    try {
      const data = await this.owner.get(
        getAwardReq.name,
        "/v1/global/getTurntableRecord",
        getAwardReq.param
      );
      const currencyId = data.data.every((item) => "currencyId" in item);
      const userId = data.data.every((item) => "userId" in item);
      if (!currencyId) {
        broadcast.cast(`ERR:currencyId缺失`);
      } else if (!userId) {
        broadcast.cast(`ERR:userId缺失`);
      } else {
        broadcast.cast(`:${getAwardReq.name}验证通过`);
      }
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
}

module.exports = Wheel;
