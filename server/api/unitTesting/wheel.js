const { compose } = require("../config/config");
const {
  playGameWheel,
  getTunTableTime,
  getTurntableRecord,
} = require("../config/index");

async function wheel() {
  await compose(playGameWheel, getTunTableTime, getTurntableRecord);
}
module.exports = {
  wheel: wheel,
};
