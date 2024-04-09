const {
  registerAndLogin,
  login,
  autoLogin,
  expiredLogin,
  errLogin,
} = require("../config");
const { compose } = require("../config/config");
async function registrify() {
  await compose(registerAndLogin, login, expiredLogin, errLogin, autoLogin);
}
module.exports = {
  registrify: registrify,
};
