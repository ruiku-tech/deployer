const { compose } = require("./config/config");
const host = require("./config/host");
const { getGameHistory } = require("./unitTesting/gameHistory");
const { gridNine } = require("./unitTesting/gridNine");
const { game } = require("./unitTesting/originais");
const { registrify } = require("./unitTesting/register");
const { UserInformation } = require("./unitTesting/user");
const { wallet } = require("./unitTesting/wallet");
const { socket } = require("./unitTesting/webSocket");
const { wheel } = require("./unitTesting/wheel");
// registrify();
// gridNine();
// 注册登录-> socket ->个人档案->钱包->游戏记录(游戏拉取,真假pg登录，搜索等) -> 转盘 -> 九宫格->游戏

function init(env) {
  host.init(env);
  compose(
    registrify,
    socket,
    UserInformation,
    wallet,
    getGameHistory,
    wheel,
    gridNine,
    game
  );
}
module.exports = { init: init };
