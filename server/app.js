const express = require("express");
const path = require("path");
var http = require("http");
const cors = require("cors");
const broadcast = require("./broadcast");
const env = require("./env.middleware");
const fs = require("fs");

const app = express();
const port = 3000;

// 初始化环境
const workspaceDir = path.resolve(__dirname, "workspace");
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir);
}

app.use(cors());
// 静态文件中间件，用于提供Vue应用的静态资源
app.use("/static", express.static(path.join(__dirname, "dist")));

var indexRouter = require("./deploy");
app.use("/deploy", env.contextMaker, indexRouter);

// 处理所有GET请求，返回Vue应用的主页
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
var server = http.createServer(app);
broadcast.init(server);
server.listen(port, () => {
  console.log("服务器启动", port);
});
