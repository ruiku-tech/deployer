const broadcast = require("../../service/broadcast");

class Wallet {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.getUserBalance();
    await this.getPayoutRecord();
    await this.createOrder();
    await this.queryPayoutAmount();
    await this.createPayout();
    await this.createRecharge();
    await this.payPayout();
    await this.createRecharge(1, "hkp");
    await this.createRecharge(2, "kaka");
    await this.payoutAutoTest();
  }
  /** 获取获取用户各个币种的余额 */
  async getUserBalance() {
    try {
      const data = await this.owner.get(
        "获取各个币种余额",
        "/v1/user/getBalance"
      );
      const currencyId = data.data.every((item) => "currencyId" in item);
      const value = data.data.every((item) => "value" in item);
      if (!currencyId) {
        broadcast.cast(`ERR:currencyId缺失`);
      } else if (!value) {
        broadcast.cast(`ERR:金额缺失`);
      } else {
        this.owner.updateData("money", data.data[0].value);
        broadcast.cast(`:获取各个币种余额验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取各个币种余额验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**获取提现记录 */
  async getPayoutRecord() {
    try {
      const data = await this.owner.get(
        "获取提现记录",
        "/v1/balance/getPayoutRecord",
        {
          pageSize: 10,
          pageNum: 1,
        }
      );
      if (!data.data.data) {
        broadcast.cast(`ERR:提现数据缺失`);
      } else {
        broadcast.cast(`:获取提现记录测试验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取提现记录验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**创建充值 */
  async createOrder() {
    try {
      const data = await this.owner.post(
        "创建充值",
        "/v1/thirdPay/createOrder",
        {
          userId: this.owner.data["userId"],
          amount: 20,
          payType: "PIX_QRCODE",
        }
      );
      if (!data.data) {
        broadcast.cast(`ERR:充值链接缺失`);
      } else {
        broadcast.cast(`:创建充值验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:创建充值验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**查询可以提现的余额 */
  async queryPayoutAmount() {
    try {
      const data = await this.owner.get(
        "查询可以提现的余额",
        "/v1/thirdPay/queryPayoutAmount",
        {
          userId: this.owner.data["userId"],
        }
      );
      if (!data.data) {
        broadcast.cast(`ERR:数据缺失\n${JSON.stringify(data)}`);
      } else {
        broadcast.cast(`:查询可以提现的余额验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:查询可以提现的余额验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**创建提现 */
  async createPayout() {
    try {
      const data = await this.owner.post(
        "创建提现",
        "/v1/thirdPay/createPayout",
        {
          amount: 10,
          type: "PIX_EMAIL",
          userId: this.owner.data["userId"],
          accountNo: "1451053372@qq.com",
        }
      );
      if (!data.data) {
        broadcast.cast(`ERR:数据缺失\n${JSON.stringify(data)}`);
      } else {
        broadcast.cast(`:创建提现验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:创建提现验证失败\n${JSON.stringify(error)}`);
    }
  }

  /**创建新充值 */
  async rechargeAutoTest() {
    try {
      const data = await this.owner.post("创建新充值", "/pay/v1/recharge", {
        amount: 20,
        payType: "PIX_QRCODE",
      });
      if (!data.data) {
        broadcast.cast(`ERR:充值链接缺失`);
      } else {
        broadcast.cast(`:创建充值验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:创建新充值验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**充值测试 */
  async createRecharge(type, name) {
    try {
      // this.owner.updateHeader("Content-Type", "application/json");
      const data = await this.owner.post(
        `充值测试${name}`,
        `/pay/v1/rechargeAutoTest?type=${type}`,
        {
          amount: 100,
          payType: "PIX_QRCODE",
        }
      );
      if (!data.data) {
        broadcast.cast(`ERR:充值测试${name}链接缺失`);
      } else {
        broadcast.cast(`:充值测试${name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:充值测试${name}验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**提现自动化测试 */
  async payoutAutoTest() {
    try {
      const data = await this.owner.post(
        `提现自动化测试`,
        `/pay/v1/payoutAutoTest?type=1`,
        {
          amount: 1,
          type: "PIX_EMAIL",
          accountNo: "1451053372@qq.com",
        }
      );
      if (!data.data) {
        broadcast.cast(`ERR:提现自动化测试链接缺失`);
      } else {
        broadcast.cast(`:提现自动化测试验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:提现自动化测试验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**创建新提现 */
  async payPayout() {
    try {
      const data = await this.owner.post("创建新提现", "/pay/v1/payout", {
        amount: 10,
        type: "PIX_EMAIL",
        accountNo: "1451053372@qq.com",
      });
      if (!data.data) {
        broadcast.cast(`ERR:数据缺失\n${JSON.stringify(data)}`);
      } else {
        broadcast.cast(`:创建新提现验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:创建新提现验证失败\n${JSON.stringify(error)}`);
    }
  }
}
module.exports = Wallet;
