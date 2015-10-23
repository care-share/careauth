'use strict';

// import external modules
var Q = require('q');

// import internal modules
var app = require('../../lib/app');
var Account = app.Account;
var respond = require('../../lib/utils').respond;

exports.register = function (req, res) {
    var name_first = req.body.name_first;
    var name_last = req.body.name_last;
    var email = req.body.email;
    var password = req.body.password;
    if (!name_first || !name_last || !email || !password) {
        respond(res, 400);
        return;
    }

    var user = new Account({name_first: name_first, name_last: name_last, email: email});
    // mongoose-q will not q-ify the 'register' method provided by passport, just use ninvoke...
    Q.ninvoke(Account, 'register', user, password)
    .then(function () {
        respond(res, 201);
    }).catch(function (err) {
        if (err.name === 'BadRequestError' && err.message && err.message.indexOf('exists') > -1) {
            // user already exists
            respond(res, 409);
        }
        else if (err.name === 'BadRequestError' && err.message && err.message.indexOf('argument not set')) {
            respond(res, 400);
        }
        else {
            respond(res, 500);
        }
    }).done();
};

exports.login = function (req, res) {
    // we only get to this point if the user has successfully authenticated through Passport
    // however, we don't want to authenticate any users who haven't yet been approved; check for that here
    if (!req.user.approved) {
        respond(res, 403);
        return;
    }

    Account.createUserToken(req.user.email)
    .then(function (result) {
        var obj = {
            email: result.email,
            name_first: result.name_first,
            name_last: result.name_last,
            roles: result.roles,
            origin: result.origin,
            token: result.token.token
        };
        respond(res, 200, obj);
    }).catch(function (err) {
        app.logger.error('Failed to create user token:', err);
        respond(res, 500);
    }).done();
};

exports.logout = function (req, res) {
    // FIXME: "invalidating" this token actually doesn't do anything... i.e. the token is still valid
    Account.invalidateUserToken(req.user.email)
    .then(function () {
        respond(res, 200);
    }).catch(function (err) {
        app.logger.error('Failed to update user:', err);
        respond(res, 500);
    }).done();
};
