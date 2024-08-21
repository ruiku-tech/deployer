const fs = require('fs');
const acme = require('acme-client');
const execSync = require('child_process').execSync;
const path = require('path');
const dayjs = require('dayjs');
const broadcast = require('./broadcast');
let cxt;
function checkDir(dirPath) {
  const parentDir = path.dirname(dirPath);
  if (!fs.existsSync(parentDir)) {
    checkDir(parentDir);
    fs.mkdirSync(parentDir);
  }
}
// 在验证过程中自动创建验证文件并放置
async function createHttpChallenge(server, authz, challenge, keyAuthorization) {
  const token = challenge.token;
  broadcast.cast('INFO:开始创建验证文件');
  const fileDir = this.fileDir;
  const time = dayjs().format('YYYYMMDD-HH:mm:ss');
  const challengePath = path.resolve(fileDir, `${time}~${token}`);
  fs.writeFileSync(challengePath, keyAuthorization);
  await ctx.service.executer.deployList([
    {
      server,
      cmds: [
        `put: ${challengePath},/root/acme/${token}`,
        'run: docker exec gateway nginx -s reload',
      ],
    },
  ]);
}

// 申请证书
async function requestCertificate(server, domain, ctx1) {
  ctx = ctx1;
  const fileDir = ctx.request.context.fileDir;
  const privateKey = await acme.crypto.createPrivateKey();

  // 创建 ACME 客户端
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.production,
    accountKey: privateKey,
  });

  const time = dayjs().format('YYYYMMDD-HH:mm:ss');
  const certPath = path.resolve(fileDir, `${time}~${domain}-cert.pem`);
  const keyPath = path.resolve(fileDir, `${time}~${domain}-key.pem`);
  const [ key, csr ] = await acme.forge.createCsr({
    commonName: domain,
  });

  broadcast.cast(`INFO:${domain}开始生成证书，csr:${csr}`);
  const challengeCreateFn = createHttpChallenge.bind(
    ctx.request.context,
    server
  );

  try {
    const cert = await client.auto({
      csr,
      email: 'shipotian1990@outlook.com',
      termsOfServiceAgreed: true,
      challengePriority: [ 'http-01' ],
      challengeCreateFn,
    });
  } catch (error) {
    console.log(error, '什么问题');
    return Promise.reject(error.message);
  }
  // 保存证书和密钥
  fs.writeFileSync(certPath, cert, 'utf-8');
  fs.writeFileSync(keyPath, key, 'utf-8');

  broadcast.cast(`INFO:${domain}证书生成完毕，开始部署`);

  await ctx.service.executer.deployList([
    {
      server,
      cmds: [
        `put: ${certPath},/root/cert/cert.pem`,
        `put: ${keyPath},/root/cert/key.pem`,
        'run: docker exec gateway nginx -s reload',
      ],
    },
  ]);
}
module.exports = {
  requestCertificate,
};
