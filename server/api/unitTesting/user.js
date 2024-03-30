const {
  getUserInformation,
  userAllGameRecords,
  getQueryPersonalFiles,
} = require("../config");
const { compose } = require("../config/config");

async function UserInformation() {
  await compose(getUserInformation, userAllGameRecords, getQueryPersonalFiles);
}
module.exports = {
  UserInformation: UserInformation,
};
