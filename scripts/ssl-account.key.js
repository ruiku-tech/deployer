const crypto = require('crypto');

// 生成一个 ECDSA 密钥对
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'secp256k1', // 可以选择其他的曲线
});

console.log(privateKey,publicKey)

// 将密钥转换为 PEM 格式的字符串
const privateKeyPem = privateKey.export({
  type: 'pkcs8', // 可以选择其他的格式
  format: 'pem',
});

console.log(privateKeyPem)

const publicKeyPem = publicKey.export({
  type: 'spki', // 可以选择其他的格式
  format: 'pem',
});

console.log(publicKeyPem)

const privateKey = `-----BEGIN PRIVATE KEY-----
MIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQgitQBkrBwMc/oYdhyhGoG
5RZX7fSJZOMOMUIth5L+p4ShRANCAATuiHSsGzrz3ZjEZUTMUt5+HZy3nuJiBsrs
f1Li3Viz6e+nuOCil/2ZHO8Z6jXrLC39jVJrrZJH6VrlhERPv/XG
-----END PRIVATE KEY-----`

const publicKey = `-----BEGIN PUBLIC KEY-----
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE7oh0rBs6892YxGVEzFLefh2ct57iYgbK
7H9S4t1Ys+nvp7jgopf9mRzvGeo16ywt/Y1Sa62SR+la5YRET7/1xg==
-----END PUBLIC KEY-----`