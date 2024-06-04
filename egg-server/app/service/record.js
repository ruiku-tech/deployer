function isObjectEqual(obj1, obj2) {
  return JSON.stringify(obj1) == JSON.stringify(obj2);
}
module.exports = {
  isObjectEqual,
};
