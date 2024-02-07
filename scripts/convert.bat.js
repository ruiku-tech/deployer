const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "../server/bats");
const filenames = fs.readdirSync(dir);

const compose = "TEST";
const json = {};
filenames.forEach((filename) => {
  const filePath = path.resolve(dir, filename);
  const data = fs.readFileSync(filePath, "utf-8");
  const arr = data.split("\n");
  const host = arr[0];
  const cmds = arr.slice(1);
  const name = filename.slice(5);
  json[name] = { host, cmds };
});

fs.writeFileSync(path.resolve(dir, compose), JSON.stringify(json), "utf-8");
