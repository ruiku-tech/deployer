const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const target = "release";
const zipPath = path.resolve(__dirname, "..", "..", `${target}.zip`);
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", {
  zlib: { level: 9 }, // 设置压缩级别
});
// 监听所有 archive 数据已写入完成
output.on("close", function () {
  console.log(`压缩完成，共 ${archive.pointer()} 字节`);
  console.log("生成发布包成功", zipPath);
});

// 监听压缩过程中可能出现的错误
archive.on("error", function (err) {
  throw err;
});

// 管道输出流到文件
archive.pipe(output);

// 添加整个目录到压缩包
archive.directory(path.resolve(__dirname, "..", "app"), "app");
archive.directory(path.resolve(__dirname, "..", "config"), "config");
archive.directory(path.resolve(__dirname, "..", "scripts"), "scripts");
archive.file(path.resolve(__dirname, "..", "package.json"), {
  name: "package.json",
});
archive.file(path.resolve(__dirname, "..", "package-lock.json"), {
  name: "package-lock.json",
});
// 完成压缩操作
archive.finalize();
