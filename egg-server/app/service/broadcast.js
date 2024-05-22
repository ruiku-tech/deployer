const clients = [];
function init(socket) {
  if (!clients.includes(socket)) {
    clients.push(socket);
  }
  socket.on("message", (msg) => {
    socket.send("");
  });

  socket.on("close", (reason) => {
    console.log("Connection closed:", reason);
  });
  socket.send("Hello, client");
}
function cast(msg, env) {
  if (global.isTest) {
    console.log(msg);
  } else {
    clients.forEach((ws) => {
      if (env) {
        ws.send(`:user:${env}::${msg}`);
      } else {
        ws.send(msg);
      }
    });
  }
}

module.exports = {
  init,
  cast,
};
