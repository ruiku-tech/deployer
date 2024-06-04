const { compose } = require("../config/config");
const {
  popularizes,
  queryUserCount,
  receiveReward,
  getUserInviteUser,
  login,
  registerAndLogin,
} = require("../config/index");
//登陆 -> 查询次数-> 获取推荐 -> 查看次数是否增加 ->玩 ->记录，领取
async function gridNine() {
  await compose(
    queryUserCount,
    // registerAndLogin,
    // queryUserCount,
    popularizes,
    getUserInviteUser,
    receiveReward
  );
}
module.exports = {
  gridNine: gridNine,
};
