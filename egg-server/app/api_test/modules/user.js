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

const e = require("express");
const broadcast = require("../../service/broadcast");

class User {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.autoLogin("自动登陆");
    await this.afterToken();
    await this.retryToken();
    await this.errorToken();
    await this.loginOldAccount();
    await this.getUserInformation();
    await this.userAllGameRecords();
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
      console.log(data.data);
      if (!data.data.id) {
        broadcast.cast(`ERR:用户id缺失`);
        return Promise.reject(error);
      }
      if (!data.data.token) {
        broadcast.cast(`ERR:token缺失`);
        return Promise.reject(error);
      }
      if (!data.data.freshToken) {
        broadcast.cast(`ERR:freshToken缺失`);
        return Promise.reject(error);
      }
      broadcast.cast(`:${loginReq.name}验证通过`);
      // 更新token
      this.owner.updateHeader("auth", data.data.token);
      // 存储数据到全局
      this.owner.updateData("freshToken", data.data.freshToken);
      this.owner.updateData("userId", data.data.id);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  }
  /** 自动登陆 */
  async autoLogin(name) {
    try {
      const data = await this.owner.post(name, "/v1/user/autoLogin", {
        freshToken: this.owner.data["freshToken"],
      });
      if (!data.data.id) {
        broadcast.cast(`ERR:用户id缺失`);
        return Promise.reject(error);
      }
      if (!data.data.token) {
        broadcast.cast(`ERR:token缺失`);
        return Promise.reject(error);
      }
      if (!data.data.freshToken && name != "测试新返回的token") {
        broadcast.cast(`ERR:freshToken缺失`);
        return Promise.reject(error);
      }
      broadcast.cast(`:${name}验证通过`);
      // 更新token
      this.owner.updateHeader("auth", data.data.token);
      // 存储数据到全局
      this.owner.updateData("freshToken", data.data.freshToken);
      this.owner.updateData("userId", data.data.id);
    } catch (error) {
      if (error.code == 406) {
        broadcast.cast(`:${name}\n返回新token:${JSON.stringify(error.data)}`);
        this.owner.updateData("freshToken", error.data);
      } else if (error.code == 405) {
        broadcast.cast(`:${name}测试成功`);
      } else {
        broadcast.cast(`:${name}测试失败,\n 错误信息:${JSON.stringify(error)}`);
      }
    }
  }
  /** 过期token */
  async afterToken() {
    this.owner.updateData(
      "freshToken",
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDAwNDMwMDUsInVzZXJJZCI6NywiaWF0IjoxNzAwMDQxMjA1fQ.eFCDYrjcLHH9RQDPm48V-02gOy6J7m7Ogx-_4FXBV_k"
    );
    await this.autoLogin("token过期测试");
  }
  /** 重试过期  */
  async retryToken() {
    await this.autoLogin("测试新返回的token");
  }
  /** 错误token */
  async errorToken() {
    this.owner.updateData(
      "freshToken",
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDAwNDMwMDUsInVzZXJJZCI6NywiaWF0IjoxNzAwMDQxMjA1fQ.eFCDYrjcL9RQDPm48V-02gOy6J7m7Ogx-_4FXBV_k"
    );
    await this.autoLogin("错误token");
  }

  /**获取用户档案 */
  async getUserInformation() {
    try {
      const data = await this.owner.get(
        "获取用户档案",
        "/v1/user/getUserInformation"
      );
      if (!data.data.game) {
        broadcast.cast(`ERR:常玩游戏字段缺失`);
      } else if (!data.data.user) {
        broadcast.cast(`ERR:用户信息字段缺失`);
      } else if (!data.data.userStatistics) {
        broadcast.cast(`ERR:站点配置网络列表缺失`);
      } else {
        broadcast.cast(`:获取用户档案验证通过`);
      }
    } catch (error) {
      broadcast.cast(
        `:获取用户档案验证失败\n错误信息:\n${JSON.stringify(error)}`
      );
    }
  }
  /**获取游戏记录 */
  async userAllGameRecords() {
    try {
      const data = await this.owner.get(
        "获取游戏记录",
        "/v1/user/getGameHistory",
        {
          pageSize: 30,
          pageNumber: 1,
        }
      );
      if (!data.data.data) {
        broadcast.cast(`ERR:游戏记录列表缺失`);
      } else if (data.data.data.length < 1) {
        broadcast.cast(`TIP:用户并无游戏记录`);
      }
      broadcast.cast(`:获取游戏记录验证通过`);
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
  /**根据用户ID查询个人档案，暂未启用 */
  async getQueryPersonalFiles() {
    try {
      const data = await this.owner.get(
        "根据用户ID查询个人档案",
        "/v1/global/getUserInfo",
        {
          userId: this.owner.data["userId"],
        }
      );
      broadcast.cast(
        `:根据用户ID查询个人档案验证通过\n${JSON.stringify(data)}`
      );
    } catch (error) {
      // 如果需要中止后面的调用，就返回 Promise.reject(error)
      return Promise.reject(error);
    }
  }
}

module.exports = User;
