const broadcast = require("../../broadcast");

class Originais {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.playGameRocket(2, 10);
    await this.playGameDice(50, 1, 10);
  }
  /** 火箭游戏 */
  async playGameRocket(targetRate, betAmount) {
    const playGameRocketReq = {
      name: "火箭游戏",
      param: {
        gameId: 3,
      },
      json: {
        targetRate: targetRate,
        betAmount: betAmount,
        currencyId: 1,
      },
    };
    try {
      const data = await this.owner.post(
        playGameRocketReq.name,
        "/v1/userPlay/playGame?gameId=3",
        playGameRocketReq.json
      );
      if (!data.data.currencyId) {
        broadcast.cast(`ERR:currencyId字段缺失`);
      } else if (!data.data.balance) {
        broadcast.cast(`ERR:金额字段缺失`);
      } else {
        broadcast.cast(`:${playGameRocketReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:${playGameRocketReq.name}验证失败`);
    }
  }
  /** 骰子 */
  async playGameDice(predictedValue, highOrLow, betAmount) {
    const playGameDiceReq = {
      name: "骰子",
      param: {
        gameId: 1,
      },
      json: {
        predictedValue: predictedValue,
        highOrLow: highOrLow,
        betAmount: betAmount,
        currencyId: 1,
      },
    };
    try {
      const data = await this.owner.post(
        playGameDiceReq.name,
        "/v1/userPlay/playGame?gameId=1",
        playGameDiceReq.json
      );
      if (!data.data.currencyId) {
        broadcast.cast(`ERR:currencyId字段缺失`);
      } else if (!data.data.balance) {
        broadcast.cast(`ERR:金额字段缺失`);
      } else {
        broadcast.cast(`:${playGameDiceReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(
        `:${playGameDiceReq.name}验证失败\n${JSON.stringify(error)}`
      );
    }
  }
}

module.exports = Originais;
