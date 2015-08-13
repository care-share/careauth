'use strict';

var path = require('path');
var Q = require('q');
var Account = require(path.join(__dirname, '..', '/models/account'));
var Token = require(path.join(__dirname, '..', '/models/account')).Token;
var utils = require(path.join(__dirname, '..', '/include/utils'));
var respond = utils.respond;

/**
* @module Routes
*/

module.exports = function (app, passport) {

    app.get('/', function (req, res) {
        res.send('Go away');
    });

    app.post('/auth/register', function(req, res) {
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
    });

    app.post('/auth/login', passport.authenticate('local', {session: false}), function(req, res) {
        if (!req.user || !req.user.approved) {
            respond(res, 401);
            return;
        }

        Account.createUserToken(req.user.email, function(err, usersToken) {
            if (err) {
                // couldn't generate token
                respond(res, 500);
            } else {
                respond(res, 200, {token : usersToken});
            }
        });
    });

    // gets list of user accounts to approve
    // params:
    //  * token: token of an admin user
    app.get('/users/:approval', function(req, res) {
        var token = req.query.token;
        var approval = req.params.approval;
        if (!approval || (approval !== 'approved' && approval !== 'unapproved')) {
            respond(res, 404);
            return;
        }
        if (!token) {
            respond(res, 400);
            return;
        }

        Q.fcall(function() {
            return Account.decode(token);
        }).then(function (result) {
            if (result.role && result.role === 'admin') {
                var query = {approved: approval === 'approved'};
                return Q.ninvoke(Account, 'find', query, 'email name_first name_last role')
                    .then(function (result) {
                        respond(res, 200, result);
                    }).catch(function (err) {
                        console.error('Failed to update user:', err);
                        respond(res, 500);
                    });
            } else {
                respond(res, 401);
            }
        }).catch(function (err) {
            console.error('Failed to decode token:', err);
            respond(res, 400);
        }).done();
    });

    // approves a user account
    // params:
    //  * token: token of an admin user
    //  * email: email of user to approve
    app.post('/users/:email/approve', function(req, res) {
        var token = req.body.token;
        var email = req.params.email;
        if (!token || !email) {
            respond(res, 400);
            return;
        }

        Q.fcall(function() {
            return Account.decode(token);
        }).then(function (result) {
            if (result && result.role === 'admin') {
                var query = {email: email};
                var update = {approved: true};
                return Q.ninvoke(Account, 'findOneAndUpdate', query, update)
                .then(function (result) {
                    if (result) {
                        respond(res, 200);
                    } else {
                        respond(res, 404);
                    }
                }).catch(function (err) {
                    console.error('Failed to update user:', err);
                    respond(res, 500);
                });
            } else {
                respond(res, 401);
            }
        }).catch(function (err) {
            console.error('Failed to decode token:', err);
            respond(res, 400);
        }).done();
    });

    app.get('/auth/logout(\\?)?', function(req, res) {
        var incomingToken = req.body.token; //req.headers.token;
        if (!incomingToken) {
            respond(res, 400);
            return;
        }

        var decoded = Account.decode(incomingToken);
        if (!decoded || !decoded.email) {
            // couldn't decode token
            respond(res, 400);
            return;
        }

        Account.invalidateUserToken(decoded.email, function(err, user) {
            if (err) {
                respond(res, 500);
            } else {
                respond(res, 200);
            }
        });
    });
};
