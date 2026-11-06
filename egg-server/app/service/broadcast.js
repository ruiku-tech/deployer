const clients = [];
function init(socket, username) {
  const client = { socket, username };
  clients.push(client);
  socket.on('message', msg => {
    socket.send('');
  });

  socket.on('close', reason => {
    const index = clients.indexOf(client);
    if (index >= 0) clients.splice(index, 1);
    console.log('Connection closed:', reason);
  });
  socket.send('Hello, client');
}
function cast(msg, env) {
  if (global.isTest) {
    console.log(msg);
  } else {
    clients.forEach(({ socket, username }) => {
      if (env && require('./access').canAccess(username, env) && socket.readyState === 1) {
        socket.send(`环境:${env}:${msg}`);
      }
    });
  }
}

module.exports = {
  init,
  cast,
};
