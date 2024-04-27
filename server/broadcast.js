const WebSocket = require("ws");
const clients = [];
function init(server) {
  const wss = new WebSocket.Server({ server });
  wss.on("connection", (ws) => {
    if (!clients.includes(ws)) {
      clients.push(ws);
    }
    ws.on("close", () => {
      const index = clients.indexOf(ws);
      if (index >= 0) {
        clients.splice(index, 1);
      }
    });
    ws.on("message", (e) => {
      ws.send("");
    });
    ws.send("INFO:Hello, client!");
  });
}
function cast(msg) {
  if (global.isTest) {
    console.log(msg);
  } else {
    clients.forEach((ws) => {
      ws.send(msg);
    });
  }
}

module.exports = {
  init,
  cast,
};
