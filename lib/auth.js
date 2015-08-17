'use strict';

// import external modules
var jwt = require('jsonwebtoken');
var Q = require('q');

// import internal modules
var app = require('./app');

// returns a promise to make a token for a given user
exports.makeToken = function (user) {
    var jwtParams = app.config.jwtParameters();
    var obj = {
        sub: user.email,
        role: user.role
    };
    return Q.fcall(function() {
        return jwt.sign(obj, jwtParams.secret, jwtParams.options);
    });
};

// returns a promise to verify the token, and optionally verify that the user is an admin
exports.checkToken = function (token, mustBeAdmin) {
    if (!token) {
        return Q.reject(new Error('No token'));
    }

    // TODO: make sure we reject tokens that are expired
    var jwtParams = app.config.jwtParameters();
    return Q.ninvoke(jwt, 'verify', token, jwtParams.secret)
    .then(function (result) {
        if (typeof result.sub === 'undefined' || result.sub === '') {
            throw new Error('Bad token (no subject)');
        } else if (mustBeAdmin && result.role !== 'admin') {
            throw new Error('Bad token (user is not an admin)');
        } else {
            return result;
        }
    }, function (err) {
        throw new Error('Bad token (' + err.message + ')');
    });
};
