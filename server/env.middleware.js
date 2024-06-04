const path = require("path");
const fs = require("fs");
const config = require("./config");

function contextMaker(req, res, next) {
  if (!req.path.startsWith("/env") && !req.path.startsWith("/deployings")) {
    const env = req.headers.env;
    if (!env) {
      return res.send({ err: "请选择环境" });
    }
    const dir = path.resolve(__dirname, "workspace", env);

    const context = config.createContext(env);

    if (!fs.existsSync(context.dir)) {
      return res.send({ err: "当前环境不存在" });
    }
    req.context = context;
  }
  try {
    if (req.body.data) {
      JSON.parse();
    }
  } catch (error) {}
  next();
}

module.exports = {
  contextMaker,
};
