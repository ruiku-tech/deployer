const broadcast = require('../../service/broadcast');
// 生成手机号
function generateRandomNumber() {
  // 生成8位随机数
  const randomNumber = Math.floor(Math.random() * 100000000);
  // 将生成的随机数转换为字符串
  let randomNumberString = randomNumber.toString();
  // 如果随机数不满足8位，则在前面添加0，使之满足8位
  while (randomNumberString.length < 8) {
    randomNumberString = '0' + randomNumberString;
  }
  // 以 "009" 开头并拼接生成的8位随机数
  const result = '009' + randomNumberString;
  return result;
}
/** 手机注册 */
const registerReq = {
  name: '手机注册',
  json: {
    avatar: '7',
    channel: '888',
    country: '55',
    phone: generateRandomNumber(), // 这里使用 generateRandomNumber() 来生成随机手机号码
    phonePassword: 'XXxxs1232',
    pixelId: 'fb=262212126824626',
    referee: '152',
    type: 0, // 手机
  },
};
class Wheel {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.registerByPhone();
    await this.loginByPhone();
    await this.playGameWheel();
    await this.getTunTableTime();
    await this.getTurntableRecord();
  }
  async registerByPhone() {
    registerReq.json.phone = generateRandomNumber();
    try {
      const data = await this.owner.post(
        registerReq.name,
        '/v1/user/registerByPhone',
        registerReq.json
      );
      // 判断数据是否正确
      // todo
      // 如果是动态数据无法校验正确，则输出格式化数据
      broadcast.cast(`:${registerReq.name}验证通过\n${JSON.stringify(data)}`);
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
  /** 新账号登录 */
  async loginByPhone() {
    try {
      const data = await this.owner.post(
        '新用户登录',
        '/v1/user/loginByPhone',
        {
          phone: registerReq.json.phone,
          phonePassword: registerReq.json.phonePassword,
          client: 'ios',
        }
      );
      if (!data.data.id) {
        broadcast.cast('ERR:用户id缺失');
        return Promise.reject(error);
      }
      if (!data.data.token) {
        broadcast.cast('ERR:token缺失');
        return Promise.reject(error);
      }
      if (!data.data.freshToken) {
        broadcast.cast('ERR:freshToken缺失');
        return Promise.reject(error);
      }
      broadcast.cast(':新用户登录验证通过');
      // 更新token
      this.owner.updateHeader('auth', data.data.token);
      // 存储数据到全局
      this.owner.updateData('freshToken', data.data.freshToken);
      this.owner.updateData('userId', data.data.id);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /** 获取中奖值 */
  async playGameWheel() {
    const playGameWheelReq = {
      name: '获取中奖值',
      json: {
        gameId: 2,
      },
    };
    try {
      const data = await this.owner.post(
        playGameWheelReq.name,
        '/v1/userPlay/playGame?gameId=2',
        playGameWheelReq.json
      );
      if (!data.data) {
        broadcast.cast('ERR:无返回结果');
      } else {
        broadcast.cast(`:${playGameWheelReq.name}验证通过`);
      }
    } catch (error) {
      if (error.code == 20012) {
        broadcast.cast('ERR:已转过转盘');
      }
    }
  }
  /** 获取转盘时间 */
  async getTunTableTime() {
    try {
      const data = await this.owner.get(
        '获取转盘时间',
        '/v1/user/getTunTableTime'
      );
      if (!data.data) {
        broadcast.cast(`:结果无时间返回\n${JSON.stringify(data)}`);
      } else {
        broadcast.cast(':获取转盘时间验证通过');
      }
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
  /** 获取转盘奖励数据 */
  async getTurntableRecord() {
    const getAwardReq = {
      name: '获取转盘奖励数据',
      param: {
        id: 0,
        limit: '30',
      },
    };
    try {
      const data = await this.owner.get(
        getAwardReq.name,
        '/v1/global/getTurntableRecord',
        getAwardReq.param
      );
      const currencyId = data.data.every(item => 'currencyId' in item);
      const userId = data.data.every(item => 'userId' in item);
      if (!currencyId) {
        broadcast.cast('ERR:currencyId缺失');
      } else if (!userId) {
        broadcast.cast('ERR:userId缺失');
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
