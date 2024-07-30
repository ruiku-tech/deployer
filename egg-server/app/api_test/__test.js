const ApiTester = require('./index');
global.isTest = true;
new ApiTester({ host: '43.133.227.48', prefix: '/api' }).run();
