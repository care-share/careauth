/*
 * Copyright 2016 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
