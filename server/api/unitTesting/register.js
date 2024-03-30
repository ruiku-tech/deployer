const { registerAndLogin, login, autoLogin } = require("../config");
const { compose } = require("../config/config");

async function registrify() {
  await compose(registerAndLogin, login, autoLogin);
}
module.exports = {
  registrify: registrify,
};
