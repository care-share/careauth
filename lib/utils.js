'use strict';

// import external modules
var http = require('http');

function flash(info, error) {
    return {
        info: info,
        err: error
    };
}

module.exports.flash = flash;

function respond(res, code, data) {
    var obj = {
        code: code,
        message: http.STATUS_CODES[code]
    };
    if (data !== undefined)
        obj.data = data;
    res.logMessage = obj.message;
    res.status(code).json(obj);
}

module.exports.respond = respond;

function dasherize(value) {
    return value.replace(/[A-Z]/g, function (char, index) {
        return (index !== 0 ? '-' : '') + char.toLowerCase();
    });
}

module.exports.dasherize = dasherize;
