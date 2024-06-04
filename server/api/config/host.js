const { options } = require("./config");

let hostname = "";
function init(env) {
  if (env == "prod1") {
    hostname = "18.228.45.143";
  } else {
    hostname = "43.133.227.48";
  }
  options.hostname = hostname;
}
module.exports = {
  init: init,
};
