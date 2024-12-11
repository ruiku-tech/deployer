const fs = require("fs");
const path = require("path");

fs.writeFileSync("test.ini",`token=${process.env.GHTOKEN}`,"utf-8")