const { Subscription } = require('egg');
class Releases extends Subscription {
  static get schedule() { return { interval: '5s', type: 'worker', immediate: true }; }
  async subscribe() {
    if (this.app.releaseTickRunning) return;
    this.app.releaseTickRunning = true;
    try { await this.ctx.service.releases.tick(); }
    finally { this.app.releaseTickRunning = false; }
  }
}
module.exports = Releases;
