const broadcast = require("../../broadcast");

class GameHistory {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    await this.getGameGroup();
    await this.getGames();
    await this.getAllGameRecord();
    await this.getGameRecord();
    await this.loginGame();
    await this.getGameUrl();
  }
  /**获取分组 */
  async getGameGroup() {
    try {
      const data = await this.owner.get("获取分组", "/v1/game/getGameGroup");
      const id = data.data.every((item) => "id" in item);
      const name = data.data.every((item) => "name" in item);
      if (!id) {
        broadcast.cast(`ERR:分组id缺失`);
      } else if (!name) {
        broadcast.cast(`ERR:分组name缺失`);
      } else {
        broadcast.cast(`:获取分组验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:获取分组验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**获取分组游戏 */
  async getGames() {
    const getGamesReq = {
      name: "获取分组游戏",
      json: {
        groupId: 1,
        pageSize: 30,
        pageNumber: 1,
      },
    };
    try {
      const data = await this.owner.post(
        getGamesReq.name,
        "/v1/global/getGames",
        getGamesReq.json
      );
      const id = data.data.data.every((item) => "id" in item);
      const name = data.data.data.every((item) => "name" in item);
      if (!data.data.total) {
        broadcast.cast(`ERR:游戏total缺失`);
      } else if (!id) {
        broadcast.cast(`ERR:游戏id缺失`);
      } else if (!name) {
        broadcast.cast(`ERR:游戏name缺失`);
      } else {
        broadcast.cast(
          `:${getGamesReq.name}验证通过\n共${data.data.total}款游戏`
        );
      }
    } catch (error) {
      broadcast.cast(`:${getGamesReq.name}验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**获取所有游戏记录 */
  async getAllGameRecord() {
    const getGamesReq = {
      name: "获取所有游戏记录",
      json: {
        limit: 50,
        historyId: 0,
        order: "",
      },
    };
    try {
      const data = await this.owner.post(
        getGamesReq.name,
        "/v1/global/getAllGameRecord",
        getGamesReq.json
      );
      const id = data.data.every((item) => "id" in item);
      const name = data.data.every((item) => "name" in item);
      if (!id) {
        broadcast.cast(`ERR:记录id缺失`);
      } else if (!name) {
        broadcast.cast(`ERR:游戏name缺失`);
      } else {
        broadcast.cast(`:${getGamesReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:${getGamesReq.name}验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**我的游戏记录 */
  async getGameRecord() {
    const getGamesReq = {
      name: "我的游戏记录",
      param: {
        limit: 30,
      },
    };
    try {
      const data = await this.owner.get(
        getGamesReq.name,
        "/v1/userPlay/getGameRecord",
        getGamesReq.param
      );
      const id = data.data.every((item) => "id" in item);
      const currencyId = data.data.every((item) => "currencyId" in item);
      if (!id) {
        broadcast.cast(`ERR:记录id缺失`);
      } else if (!currencyId) {
        broadcast.cast(`ERR:currencyId缺失`);
      } else {
        broadcast.cast(`:${getGamesReq.name}验证通过`);
      }
    } catch (error) {
      broadcast.cast(`:${getGamesReq.name}验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**登录第三方游戏 */
  async loginGame() {
    const loginGameReq = {
      name: "登录第三方游戏",
      param: {
        gameId: 4,
      },
    };
    try {
      const data = await this.owner.get(
        loginGameReq.name,
        "/v1/third/loginGame",
        loginGameReq.param
      );
      // 判断数据是否正确
      // todo
      // 如果是动态数据无法校验正确，则输出格式化数据
      broadcast.cast(`:${loginGameReq.name}验证通过`);
    } catch (error) {
      broadcast.cast(`:${loginGameReq.name}验证失败\n${JSON.stringify(error)}`);
    }
  }
  /**登录假PG */
  async getGameUrl() {
    const falsePGReq = {
      name: "登录假PG",
      param: {
        gameId: 84,
        language: "en",
      },
    };
    try {
      const data = await this.owner.get(
        falsePGReq.name,
        "/v1/falsePg/getGameUrl",
        falsePGReq.param
      );
      // 判断数据是否正确
      // todo
      // 如果是动态数据无法校验正确，则输出格式化数据
      broadcast.cast(`:${falsePGReq.name}验证通过`);
    } catch (error) {
      broadcast.cast(`:${falsePGReq.name}验证失败\n${JSON.stringify(error)}`);
    }
  }
}
module.exports = GameHistory;
