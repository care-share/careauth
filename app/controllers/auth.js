'use strict';

// import internal modules
var app = require('../../lib/app');
var auth = require('../../lib/auth');
var respond = require('../../lib/utils').respond;

exports.checkToken = function (req, res, next) {
    verifyToken(req, res, next, false);
};

exports.checkAdminToken = function (req, res, next) {
    verifyToken(req, res, next, true);
};

function verifyToken(req, res, next, mustBeAdmin) {
    var token = req.get('X-Auth-Token');
    auth.checkToken(token, mustBeAdmin)
    .then(function (result) {
        req.user = {email: result.sub, role: result.role}; // set the user for this request (useful for controllers)
        //res.logUser = req.user;
        next();
    }).catch(function (err) {
        app.logger.warn('Failed to verify token: %s', err.message);
        respond(res, 401);
    }).done();
}
