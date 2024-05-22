const broadcast = require("../../broadcast");

class Referee {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.getUserReport();
    await this.getUserReferee();
    await this.transferRefereeToBalance();
    await this.getOutRecord();
    await this.getUserRefereeInfo();
    await this.getDayRank();
  }
  /** 获取用户推荐报告 */
  async getUserReport() {
    const getUserReportReq = {
      name: "获取用户推荐报告",
      param: {
        pageNumber: 1,
        pageSize: 10,
      },
    };

    try {
      const data = await this.owner.get(
        getUserReportReq.name,
        "/v1/referee/getUserReport",
        getUserReportReq.param
      );
      if (!data.data) {
        broadcast.cast(`ERR:无返回结果`);
      } else if (data.data.data.lenght < 1) {
        broadcast.cast(`暂无记录`);
      } else {
        broadcast.cast(`:${getUserReportReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(
        `:${getUserReportReq.name}验证失败\n${JSON.stringify(error)}`
      );
    }
  }
  /** 获取参考 */
  async getUserReferee() {
    const getUserRefereeReq = {
      name: "获取参考",
      param: {
        pageNum: 1,
        pageSize: 10,
        data: "2024-04-29",
      },
    };

    try {
      const data = await this.owner.get(
        getUserRefereeReq.name,
        "/v1/referee/getUserReferee",
        getUserRefereeReq.param
      );
      if (!data.data) {
        broadcast.cast(`ERR:无返回结果`);
      } else if (data.data.data.lenght < 1) {
        broadcast.cast(`暂无记录`);
      } else {
        broadcast.cast(`:${getUserRefereeReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(
        `:${getUserRefereeReq.name}验证失败\n${JSON.stringify(error)}`
      );
    }
  }
  /** 用户转账到钱包 */
  async transferRefereeToBalance() {
    const transferRefereeToBalanceReq = {
      name: "用户转账到钱包",
      param: {
        amount: "0.32",
      },
    };

    try {
      const data = await this.owner.get(
        transferRefereeToBalanceReq.name,
        "/v1/referee/transferRefereeToBalance",
        transferRefereeToBalanceReq.param
      );
      console.log(data);
      if (!data.data) {
        broadcast.cast(`ERR:该用户并非老玩家`);
      } else {
        broadcast.cast(`:${transferRefereeToBalanceReq.name}验证通过`);
      }
    } catch (error) {
      if (error.data.code == 20235) {
        broadcast.cast(`:用户余额不足`);
      } else {
        broadcast.cast(
          `:${transferRefereeToBalanceReq.name}验证失败\n${JSON.stringify(
            error
          )}`
        );
      }
    }
  }
  /** 查询转出记录 */
  async getOutRecord() {
    const getOutRecordReq = {
      name: "查询转出记录",
      param: {
        pageNumber: 1,
        pageSize: 10,
      },
    };
    try {
      const data = await this.owner.get(
        getOutRecordReq.name,
        "/v1/referee/getOutRecord",
        getOutRecordReq.param
      );
      if (!data.data) {
        broadcast.cast(`ERR:无返回结果`);
      } else if (data.data.data.lenght < 1) {
        broadcast.cast(`暂无记录`);
      } else {
        broadcast.cast(`:${getOutRecordReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(
        `:${getOutRecordReq.name}验证失败\n${JSON.stringify(error)}`
      );
    }
  }

  /** 获取推荐人消息 */
  async getUserRefereeInfo() {
    try {
      const data = await this.owner.get(
        "获取推荐人消息",
        "/v1/referee/getUserRefereeInfo"
      );
      if (!data.data) {
        broadcast.cast(`ERR:返回数据为空`);
      } else {
        broadcast.cast(`:获取推荐人消息验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取推荐人消息验证失败\n${JSON.stringify(error)}`);
    }
  }

  /** 获取排行榜 */
  async getDayRank() {
    try {
      const data = await this.owner.get("获取排行榜", "/v1/referee/getDayRank");
      const amount = data.data.every((item) => "amount" in item);
      const name = data.data.every((item) => "name" in item);
      if (!name) {
        broadcast.cast(`ERR:name字段缺失`);
      } else if (!amount) {
        broadcast.cast(`ERR:amount字段缺失`);
      } else {
        broadcast.cast(`:获取排行榜验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取排行榜验证失败\n${JSON.stringify(error)}`);
    }
  }
}

module.exports = Referee;
