const fs = require("fs");
const path = require("path");

const buildDirectory = path.resolve(__dirname, "../build");
fs.copyFileSync(
  path.join(buildDirectory, "index.html"),
  path.join(buildDirectory, "404.html"),
);
