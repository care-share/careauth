'use strict';

// import internal modules
var app = require('../../lib/app');
var auth = require('../../lib/auth');

exports.checkToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, false);
};

exports.checkAdminToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, true);
};
