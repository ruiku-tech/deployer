'use strict';

const { Controller } = require('egg');
const devices = require('../service/deviceSecurity');
const access = require('../service/access');

class DeviceController extends Controller {
  async status() {
    const { ctx } = this;
    ctx.set('Cache-Control', 'no-store');
    const result = devices.poll(ctx.app, ctx.request.body?.approvalToken);
    if (result.status === 'approved') ctx.body = { data: result };
    else ctx.body = { data: { status: result.status } };
  }

  async requests() {
    const { ctx } = this;
    ctx.body = { data: devices.listRequests(ctx.state.user) };
  }

  async approve() {
    const { ctx } = this;
    ctx.assert(Number.isSafeInteger(Number(ctx.request.body?.id)) && Number(ctx.request.body.id) > 0, 400, '设备申请编号无效');
    const result = devices.approve(ctx.request.body?.id, ctx.state.user, ctx.request.body?.code);
    if (result.error) ctx.throw(403, result.error);
    ctx.body = { data: 'approved' };
  }

  async deny() {
    const { ctx } = this;
    ctx.assert(Number.isSafeInteger(Number(ctx.request.body?.id)) && Number(ctx.request.body.id) > 0, 400, '设备申请编号无效');
    const result = devices.deny(ctx.request.body?.id, ctx.state.user);
    if (result.error) ctx.throw(403, result.error);
    ctx.body = { data: 'denied' };
  }
}

module.exports = DeviceController;
