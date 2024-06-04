const WebSocket = require("ws");
const broadcast = require("../../broadcast");
const ConnModal = {
  PING: -1,
  /** client to server 请求聊天记录*/
  C2S_CHAT_HISTORY: 0,
  /**server to client 聊天记录响应 */
  S2C_CHAT_HISTORY: 1,

  /** 新的聊天信息 */
  C2S_NEW_CHAT: 2,
  /**新的聊天信息 */
  S2C_NEW_CHAT: 3,

  /** 聊天信息广播*/
  S2C_CHAT_BROADCAST: 4,
  /**中奖消息世界通告 */
  S2C_WORLD_PRIZE_BROADCAST: 5,
  /**新的站内消息 */
  S2C_MEW_MSG: 6,
  /**金钱变更 */
  S2C_MONEY_CHANGE: 7,
  /**等级 */
  S2C_EXPERIENCE: 8,
  /**玩三方游戏的通知 */
  S2C_THIRD_PLAY: 9,
};
class WS {
  constructor(owner) {
    // this.ower可以调用 register，updateHeader，post，get
    this.owner = owner;
    this.owner.register(this);
  }
  async start() {
    this.socket();
  }
  socket() {
    const socketUrl = `ws://43.133.227.48/api/socket/${this.owner.data["freshToken"]}`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = function (event) {
      const message = {
        model: 2,
        data: { type: 0, content: "群聊发消息自动化测试" },
        id: 4,
      };
      socket.send(JSON.stringify(message));
      console.log("已连接ws");
    };

    socket.onmessage = function (event) {
      let onmessage = JSON.parse(event.data);
      switch (parseInt(onmessage.model)) {
        case ConnModal.PING:
          break;
        case ConnModal.C2S_CHAT_HISTORY:
          break;
        case ConnModal.S2C_CHAT_HISTORY:
          break;
        case ConnModal.C2S_NEW_CHAT:
          break;
        case ConnModal.S2C_NEW_CHAT:
          break;
        case ConnModal.S2C_CHAT_BROADCAST:
          broadcast.cast(`:群聊ws:${onmessage.data.content}`);
          break;
        case ConnModal.S2C_WORLD_PRIZE_BROADCAST:
          break;
        case ConnModal.S2C_MEW_MSG:
          break;
        case ConnModal.S2C_MONEY_CHANGE:
          break;
        case ConnModal.S2C_EXPERIENCE:
          broadcast.cast(`:经验ws:${JSON.stringify(onmessage.data)}`);
          break;
        case ConnModal.S2C_THIRD_PLAY:
          break;
        default:
          break;
      }
    };

    socket.onclose = function (event) {
      console.log("连接已关闭");
    };
  }
}
module.exports = WS;
