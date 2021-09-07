const moment = require("moment");

module.exports = function messageFormat(username, content) {
  return {
    username,
    content,
    time: moment().format("h:mm a"),
  };
};
