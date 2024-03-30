//自研游戏
const {
  playGameDice,
  playGameRocket,
  getUserBalance,
} = require("../config/index");
const broadcast = require("../../broadcast");
// .then(() => {});
//骰子游戏
let money = 0;
let count = 1;
let highOrLow = 0;
let diceBalance = [];
let diceWin = 0;
let rocketBalance = [];
let rocketWin = 0;
async function test() {
  if (count < 10) {
    await playGameDice(50, highOrLow, 10).then((resp) => {
      let parseResp = JSON.parse(resp);
      if (parseResp.code == 200) {
        if (parseResp.data.isWin == 0) {
          diceWin += 1;
        }
        diceBalance.push(parseResp.data.balance);
      }
      if (count > 5) {
        highOrLow = 1;
      }
      count++;
      test();
    });
  } else {
    await playGameRocket(2, 10).then((resp) => {
      let parseResp = JSON.parse(resp);
      if (parseResp.data.isWin == 0) {
        rocketWin += 1;
      }
      rocketBalance.push(parseResp.data.balance);
      if (count < 20) {
        count++;
        test();
      } else {
        broadcast.cast(
          `:共游戏20把,其中火箭和骰子各10把\n骰子:\n金额变动:${money}-${
            diceBalance[diceBalance.length - 1]
          }\n获胜:${diceWin}次\n\n火箭:\n金额变动:${
            diceBalance[diceBalance.length - 1]
          }-${rocketBalance[diceBalance.length - 1]}\n获胜:${rocketWin}次`
        );
      }
    });
  }
}
async function game() {
  await getUserBalance().then((resp) => {
    let parseResp = JSON.parse(resp);
    if (parseResp) {
      money = parseResp.data[0].value;
      test();
    }
  });
}
module.exports = {
  game: game,
};
