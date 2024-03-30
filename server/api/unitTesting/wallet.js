const {
  getUserBalanceHistory,
  getPayoutRecord,
  createOrder,
  queryPayoutAmoun,
  createPayout,
} = require("../config");
const { compose } = require("../config/config");

async function wallet() {
  await compose(
    getUserBalanceHistory,
    getPayoutRecord,
    createOrder,
    queryPayoutAmoun,
    createPayout
  );
}
module.exports = {
  wallet: wallet,
};
