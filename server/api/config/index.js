const {
  configOptions,
  makeHttpRequest,
  generateRandomNumber,
  options,
} = require("./config.js");
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
function registerByPhone() {
  return makeHttpRequest(
    configOptions("/v1/user/registerByPhone", "POST"),
    registerReq
  );
}
/** 手机登陆 */
function loginByPhone() {
  const loginByPhoneReq = {
    name: "手机登陆",
    json: {
      phone: registerReq.json.phone,
      phonePassword: registerReq.json.phonePassword,
      client: "ios",
    },
  };
  return new Promise((resolve) => {
    makeHttpRequest(
      configOptions("/v1/user/loginByPhone", "POST"),
      loginByPhoneReq
    ).then((response) => {
      let res = JSON.parse(response);
      if (res.code == 200) {
        resolve(response);
      }
    });
  });
}
/** 手机注册加登陆 */
function registerAndLogin() {
  return new Promise((resolve) => {
    registerByPhone().then((resp) => {
      loginByPhone().then((resp) => {
        resolve(resp);
      });
    });
  });
}
var freshToken = "";
var userId = "";
/** 登陆 */
function login() {
  const loginReq = {
    name: "邮箱登陆",
    json: {
      email: "666666@qq.com",
      password: "Ss141242",
      client: "ios",
    },
  };
  return new Promise((resolve) => {
    makeHttpRequest(configOptions("/v1/user/login", "POST"), loginReq).then(
      (response) => {
        let res = JSON.parse(response);
        if (res.code == 200) {
          options.headers["auth"] = res.data.token;
          freshToken = res.data.freshToken;
          userId = res.data.userId;
          resolve(response);
        }
      }
    );
  });
}
/** 获取中奖值 */
function playGameWheel() {
  const playGameWheelReq = {
    name: "获取中奖值",
    json: {
      gameId: 2,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/userPlay/playGame", "POST"),
    playGameWheelReq
  );
}
/** 获取转盘时间 */
function getTunTableTime() {
  return makeHttpRequest(configOptions("/v1/user/getTunTableTime", "GET"), {
    name: "获取转盘时间",
  });
}
/** 获取转盘奖励数据 */
function getTurntableRecord() {
  const getAwardReq = {
    name: "获取转盘奖励数据",
    param: {
      id: 0,
      limit: "30",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/global/getTurntableRecord", "GET"),
    getAwardReq
  );
}
/** 查询用户次数 */
function queryUserCount() {
  return makeHttpRequest(
    configOptions("/v1/popularize/queryUserCount", "GET"),
    {
      name: "查询用户次数",
    }
  );
}
/** 玩九宫格 */
function popularizes() {
  return makeHttpRequest(configOptions("/v1/popularize/popularizes", "GET"), {
    name: "玩九宫格",
  });
}
/** 查询记录 */
function getUserInviteUser() {
  return makeHttpRequest(
    configOptions("/v1/popularize/getUserInviteUser", "GET"),
    {
      name: "查询记录",
    }
  );
}
/** 领取奖励 */
function receiveReward() {
  return makeHttpRequest(configOptions("/v1/popularize/receiveReward", "GET"), {
    name: "领取奖励",
  });
}
/** 火箭游戏 */
function playGameRocket(targetRate, betAmount) {
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
  return makeHttpRequest(
    configOptions("/v1/userPlay/playGame", "POST"),
    playGameRocketReq
  );
}
/** 骰子 */
function playGameDice(predictedValue, highOrLow, betAmount) {
  const registerReq = {
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
  return makeHttpRequest(
    configOptions("/v1/userPlay/playGame", "POST"),
    registerReq
  );
}
/** 获取配置 */
function webConfig() {
  const registerReq = {
    name: "获取配置",
  };
  return makeHttpRequest(
    configOptions("/v1/global/getCurrencyAndNetwork", "GET"),
    registerReq
  );
}
/** 获取获取用户各个币种的余额 */
function getUserBalance() {
  const registerReq = {
    name: "获取各个币种余额",
  };
  return makeHttpRequest(
    configOptions("/v1/user/getBalance", "GET"),
    registerReq
  );
}
/** 自动登陆 */
function autoLogin() {
  const autoLoginReq = {
    name: "自动登录",
    json: {
      freshToken: freshToken,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/user/autoLogin", "POST"),
    autoLoginReq
  );
}
/** 过期token */
function expiredLogin() {
  const autoLoginReq = {
    name: "过期token",
    json: {
      freshToken:
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDAwNDMwMDUsInVzZXJJZCI6NywiaWF0IjoxNzAwMDQxMjA1fQ.eFCDYrjcLHH9RQDPm48V-02gOy6J7m7Ogx-_4FXBV_k",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/user/autoLogin", "POST"),
    autoLoginReq
  );
}
/** 过期token */
function errLogin() {
  const autoLoginReq = {
    name: "错误token",
    json: {
      freshToken:
        "J0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDAwNDMwMDUsInVzZXJJZCI6NywiaWF0IjoxNzAwMDQxMjA1fQ.eFCDYrjcLHH9RQDPm48V-02gOy6J7m7Ogx-_4FXBV_k",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/user/autoLogin", "POST"),
    autoLoginReq
  );
}
/** 用户信息 */
/**获取用户档案 */
function getUserInformation() {
  const getUserInformationReq = {
    name: "获取用户档案",
  };
  return makeHttpRequest(
    configOptions("/v1/user/getUserInformation", "GET"),
    getUserInformationReq
  );
}
/**获取游戏记录 */
function userAllGameRecords() {
  const userAllGameRecordsReq = {
    name: "获取游戏记录",
    param: {
      pageSize: 30,
      pageNumber: 1,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/user/getGameHistory", "GET"),
    userAllGameRecordsReq
  );
}
/**根据用户ID查询个人档案 */
function getQueryPersonalFiles() {
  const getQueryPersonalFilesReq = {
    name: "根据用户ID查询个人档案",
    param: {
      userId: userId,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/global/getUserInfo", "GET"),
    getQueryPersonalFilesReq
  );
}

/** 钱包 */
/**获取用户各个币种的·交易历史 */
function getUserBalanceHistory() {
  const getUserBalanceHistoryReq = {
    name: "获取用户各个币种的·交易历史",
  };
  return makeHttpRequest(
    configOptions("/v1/balance/getUserBalanceHistory", "GET"),
    getUserBalanceHistoryReq
  );
}
/**获取提现记录 */
function getPayoutRecord() {
  const getPayoutRecordReq = {
    name: "获取提现记录",
    param: {
      pageSize: 30,
      pageNumber: 1,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/balance/getPayoutRecord", "GET"),
    getPayoutRecordReq
  );
}
/**创建充值 */
function createOrder() {
  const createOrderReq = {
    name: "创建充值",
    json: {
      userId: userId,
      amount: 20,
      payType: "PIX_QRCODE",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/createOrder", "POST"),
    createOrderReq
  );
}
/**查询可以提现的余额 */
function queryPayoutAmoun() {
  const queryPayoutAmountReq = {
    name: "查询可以提现的余额",
    param: {
      userId: userId,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/queryPayoutAmount", "GET"),
    queryPayoutAmountReq
  );
}
/**创建提现 */
function createPayout() {
  const createPayoutReq = {
    name: "创建提现",
    json: {
      amount: 10,
      type: "PIX_CPF",
      userId: userId,
      accountNo: "1451053372@qq.com",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/createPayout", "POST"),
    createPayoutReq
  );
}
/**查询充值 */
function queryRecharge() {
  const queryRechargeReq = {
    name: "查询充值",
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/queryRecharge", "GET"),
    queryRechargeReq
  );
}
/**查询提现 */
function queryPayout() {
  const queryPayoutReq = {
    name: "查询提现",
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/queryPayout", "GET"),
    queryPayoutReq
  );
}
/**获取充值未上报事件 */
function getEventReport() {
  const getEventReportReq = {
    name: "获取充值未上报事件",
    param: {
      userId: userId,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/getEventReport", "GET"),
    getEventReportReq
  );
}
/**处理充值上报事件 */
function updateEventReport() {
  const updateEventReportReq = {
    name: "处理上报事件",
    param: {
      reportId: 1,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/thirdPay/updateEventReport", "GET"),
    updateEventReportReq
  );
}

/**获取分组 */
function getGameGroup() {
  const getGameGroupReq = {
    name: "获取分组",
  };
  return makeHttpRequest(
    configOptions("/v1/game/getGameGroup", "GET"),
    getGameGroupReq
  );
}
/**获取分组游戏 */
function getGames() {
  const getGamesReq = {
    name: "获取分组游戏",
    json: {
      groupId: 1,
      pageSize: 30,
      pageNumber: 1,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/global/getGames", "POST"),
    getGamesReq
  );
}
/**获取所有游戏记录 */
function getAllGameRecord() {
  const getAllGameRecordReq = {
    name: "获取所有游戏记录",
    json: {
      limit: 50,
      historyId: 0,
      order: "",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/global/getAllGameRecord", "POST"),
    getAllGameRecordReq
  );
}
/**我的游戏记录 */
function getGameRecord() {
  const updateEventReportReq = {
    name: "我的游戏记录",
    param: {
      limit: 30,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/userPlay/getGameRecord", "GET"),
    updateEventReportReq
  );
}
/**登录第三方游戏 */
function loginGame() {
  const loginGameReq = {
    name: "登录第三方游戏",
    param: {
      gameId: 4,
    },
  };
  return makeHttpRequest(
    configOptions("/v1/third/loginGame", "GET"),
    loginGameReq
  );
}
/**登录假PG */
function getGameUrl() {
  const falsePGReq = {
    name: "登录假PG",
    param: {
      gameId: 84,
      language: "en",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/falsePg/getGameUrl", "GET"),
    falsePGReq
  );
}
/**查询游戏 */
function selectGame() {
  const selectGameReq = {
    name: "查询游戏",
    param: {
      keyWord: "fo",
    },
  };
  return makeHttpRequest(
    configOptions("/v1/global/selectGame", "GET"),
    selectGameReq
  );
}

module.exports = {
  login: login,
  registerByPhone: registerByPhone,
  loginByPhone: loginByPhone,
  registerAndLogin: registerAndLogin,
  playGameWheel: playGameWheel,
  getTunTableTime: getTunTableTime,
  getTurntableRecord: getTurntableRecord,
  popularizes: popularizes,
  queryUserCount: queryUserCount,
  receiveReward: receiveReward,
  getUserInviteUser: getUserInviteUser,
  playGameRocket: playGameRocket,
  playGameDice: playGameDice,
  webConfig: webConfig,
  getUserBalance: getUserBalance,
  autoLogin: autoLogin,
  getUserInformation: getUserInformation,
  userAllGameRecords: userAllGameRecords,
  getQueryPersonalFiles: getQueryPersonalFiles,
  getUserBalanceHistory,
  getPayoutRecord: getPayoutRecord,
  createOrder: createOrder,
  queryPayoutAmoun: queryPayoutAmoun,
  createPayout: createPayout,
  queryRecharge: queryRecharge,
  queryPayout: queryPayout,
  getEventReport: getEventReport,
  updateEventReport: updateEventReport,
  getGameGroup: getGameGroup,
  getGames: getGames,
  getAllGameRecord: getAllGameRecord,
  getGameRecord: getGameRecord,
  loginGame: loginGame,
  getGameUrl: getGameUrl,
  selectGame: selectGame,
  expiredLogin: expiredLogin,
  errLogin: errLogin,
};
