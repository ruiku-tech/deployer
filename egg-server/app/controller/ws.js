// app/controller/ws.js
const Controller = require('egg').Controller;
const broadcast = require('../service/broadcast');
class WSController extends Controller {
  async connect() {
    const { ctx, app } = this;
    const { websocket } = ctx;
    broadcast.init(websocket);
  }
}

module.exports = WSController;
