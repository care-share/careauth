'use strict';

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
    Account.register(user, password, function(err, account) {
        if (err) {
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
        } else {
            respond(res, 201);
        }
    });
};

exports.login = function (req, res) {
    // we only get to this point if the user has successfully authenticated through Passport
    // however, we don't want to authenticate any users who haven't yet been approved; check for that here
    if (!req.user.approved) {
        respond(res, 401);
        return;
    }

    Account.createUserToken(req.user.email, function(err, usersToken) {
        if (err) {
            // couldn't generate token
            respond(res, 500);
        } else {
            var obj = {
                email: req.user.email,
                name_first: req.user.name_first,
                name_last: req.user.name_last,
                role: req.user.role,
                token: usersToken
            };
            respond(res, 200, obj);
        }
    });
};

exports.logout = function (req, res) {
    // FIXME: "invalidating" this token actually doesn't do anything... i.e. the token is still valid
    return Q.ninvoke(Account, 'invalidateUserToken', req.user.email)
    .then(function () {
        respond(res, 200);
    }).catch(function (err) {
        app.logger.error('Failed to update user:', err);
        respond(res, 500);
    }).done();
};
