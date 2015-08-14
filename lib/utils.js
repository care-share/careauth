var http = require('http');

function flash (info, error) {
    return {
        info: info,
        err: error
    };
}

module.exports.flash = flash;

function respond(res, code, data) {
    var obj = {
        message: http.STATUS_CODES[code]
    };
    if (data !== undefined)
        obj.data = data;
    res.status(code).json(obj);
}

module.exports.respond = respond;

