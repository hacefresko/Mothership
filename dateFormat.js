exports.format = function () {
    var util = require('util'); 

    let date = new Date();
    let month = date.getMonth() + 1;
    return util.format("[%d/%d %d:%d:%d]", date.getDate(), month, date.getHours(), date.getMinutes(), date.getSeconds());
};