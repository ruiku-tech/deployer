const broadcast = require('../../service/broadcast');

class Cashback {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.getCashBack();
    await this.receiveCashBack();
  }
  /** 获取返现 */
  async getCashBack() {
    try {
      const data = await this.owner.get('获取返现', '/v1/user/getCashBack');
      if (!data.data.userCashBackRecord) {
        broadcast.cast('ERR:活动尚未开始');
      } else {
        broadcast.cast(':获取返现验证通过');
      }
    } catch (error) {
      broadcast.cast(`:获取返现验证失败\n${JSON.stringify(error)}`);
    }
  }
  /** 领取奖励 */
  async receiveCashBack() {
    try {
      const data = await this.owner.get(
        '领取返现奖励',
        'v1/user/receiveCashBack'
      );
      if (!data.data) {
        broadcast.cast('ERR:无返回数据');
      } else {
        broadcast.cast(':领取返现奖励验证通过');
      }
    } catch (error) {
      broadcast.cast(`:领取返现奖励验证失败\n${JSON.stringify(error)}`);
    }
  }
}

module.exports = Cashback;
