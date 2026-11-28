'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Executer = require('../app/service/executer');

test('same-server deployment items run in order and expose the remaining queue', async () => {
  const service = Object.create(Executer.prototype);
  service.env = 'queue-test';
  const pending = [];
  service.deply = item => new Promise(resolve => pending.push({ name: item.name, resolve }));
  const deployment = service.deployList([
    { name: 'upload', server: { host: 'host-a' }, cmds: [] },
    { name: 'restart', server: { host: 'host-a' }, cmds: [] },
    { name: 'health-check', server: { host: 'host-a' }, cmds: [] },
  ]);

  assert.deepEqual(service.getDeploymentStatuses('queue-test'), [{
    host: 'host-a', status: 'deploying', currentItem: 'upload',
    queuedItems: 2, queuedNames: [ 'restart', 'health-check' ],
  }]);

  pending[0].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(pending.map(item => item.name), [ 'upload', 'restart' ]);
  assert.deepEqual(service.getDeploymentStatuses('queue-test'), [{
    host: 'host-a', status: 'deploying', currentItem: 'restart',
    queuedItems: 1, queuedNames: [ 'health-check' ],
  }]);

  pending[1].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.getDeploymentStatuses('queue-test')[0].currentItem, 'health-check');
  assert.equal(service.getDeploymentStatuses('queue-test')[0].queuedItems, 0);
  pending[2].resolve();
  await deployment;
  assert.deepEqual(service.getDeploymentStatuses('queue-test'), []);
});
