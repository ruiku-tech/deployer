// 用户模块，负责登录注册，用户数据校验

//生成手机号
function generateRandomNumber() {
  // 生成8位随机数
  var randomNumber = Math.floor(Math.random() * 100000000);
  // 将生成的随机数转换为字符串
  var randomNumberString = randomNumber.toString();
  // 如果随机数不满足8位，则在前面添加0，使之满足8位
  while (randomNumberString.length < 8) {
    randomNumberString = "0" + randomNumberString;
  }
  // 以 "009" 开头并拼接生成的8位随机数
  var result = "009" + randomNumberString;
  return result;
}
/** 手机注册 */
const registerReq = {
  name: "手机注册",
  json: {
    avatar: "7",
    channel: "888",
    country: "55",
    phone: generateRandomNumber(), // 这里使用 generateRandomNumber() 来生成随机手机号码
    phonePassword: "XXxxs1232",
    pixelId: "fb=262212126824626",
    referee: "152",
    type: 0, // 手机
  },
};

const broadcast = require("../../broadcast");

class User {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.registerByPhone();
    await this.loginByRegister();
    await this.loginOldAccount();
  }
  async registerByPhone() {
    try {
      const data = await this.owner.post(
        registerReq.name,
        "/v1/user/loginByPhone",
        {
          phone: registerReq.json.phone,
          phonePassword: registerReq.json.phonePassword,
          client: "ios",
        }
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
  /**新账号登录 */
  async loginByRegister() {
    try {
      const data = await this.owner.post("新用户登录", "/v1/user/login", {
        phone: registerReq.json.phone,
        phonePassword: registerReq.json.phonePassword,
        client: "ios",
      });
      broadcast.cast(`:新用户登录\n${JSON.stringify(data)}`);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /**老账号登录 */
  async loginOldAccount() {
    const loginReq = {
      name: "邮箱登陆",
      json: {
        email: "666666@qq.com",
        password: "Ss141242",
        client: "ios",
      },
    };
    try {
      const data = await this.owner.post(
        loginReq.name,
        "/v1/user/login",
        loginReq.json
      );
      broadcast.cast(`:${loginReq.name}验证通过\n${JSON.stringify(data)}`);
      // 更新token
      this.owner.updateHeader("auth", data.token);
      // 存储数据到全局
      this.owner.updateData("freshToken",data.freshToken)
      this.owner.updateData("userId",data.userId)
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

module.exports = User;
