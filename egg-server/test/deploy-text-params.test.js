'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DeployController = require('../app/controller/deploy');

function makeController(body) {
  let submittedPayload;
  let preparedPayload;
  const ctx = {
    request: { body, headers: { env: 'element-chat' } },
    state: { user: { username: 'developer' } },
    service: {
      releases: {
        create: async (env, payload) => {
          submittedPayload = { env, payload };
          return 42;
        },
        prepare: (env, payload) => {
          preparedPayload = { env, payload };
        },
      },
    },
    app: {
      createAnonymousContext: () => ({
        service: { releases: { execute: async (env, payload) => {
          submittedPayload = { env, payload };
        } } },
      }),
    },
    assert(condition, status, message) {
      if (!condition) {
        const error = new Error(message);
        error.status = status;
        throw error;
      }
    },
  };
  const controller = Object.create(DeployController.prototype);
  controller.ctx = ctx;
  return { ctx, run: () => controller.postDeploy(ctx), getPayloads: () => ({ submittedPayload, preparedPayload }) };
}

test('deployment passes Chinese TEXT values to immediate and scheduled releases', async () => {
  const texts = { 用户名: 'gable', 密码: 'gable12321' };
  const list = [{ cmds: [ '新增角色' ], host: 'element服务器', name: '添加角色' }];

  const immediate = makeController({ list, texts });
  await immediate.run();
  const immediatePayloads = immediate.getPayloads();
  assert.deepEqual(immediatePayloads.preparedPayload.payload.texts, texts);
  assert.deepEqual(immediatePayloads.submittedPayload.payload.texts, texts);

  const scheduled = makeController({ list, texts, runAt: Date.now() + 60000 });
  await scheduled.run();
  assert.deepEqual(scheduled.getPayloads().submittedPayload.payload.texts, texts);
});
