'use strict';

// import internal modules
var app = require('../../lib/app');
var auth = require('../../lib/auth');

// makes sure a user is logged in
exports.checkToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next);
};

// make sure a user is an admin
exports.checkAdminToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, true);
};

// makes sure a user is an admin, or is the owner of this resource
exports.checkAdminOrOwnerToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, true, req.params.id);
};
