const {
  getGameGroup,
  getGames,
  getAllGameRecord,
  getGameRecord,
  loginGame,
  getGameUrl,
  selectGame,
  login,
} = require("../config");
const { compose } = require("../config/config");

async function getGameHistory() {
  await compose(
    // login,
    getGameGroup,
    getGames,
    getAllGameRecord,
    getGameRecord,
    loginGame,
    getGameUrl,
    selectGame
  );
}
module.exports = {
  getGameHistory: getGameHistory,
};
