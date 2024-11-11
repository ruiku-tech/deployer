/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  static: {
    enable: true,
  },
  multipart: {
    enable: true,
    package: "egg-multipart",
  },
  cors: {
    enable: true,
    package: "egg-cors",
  },
  websocket: {
    enable: true,
    package: "egg-websocket-plugin",
  },
  mongoose: {
    enable: true,
    package: "egg-mongoose",
  },
  jwt: {
    enable: true,
    package: "egg-jwt",
  },
};
