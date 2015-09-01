'use strict';

// import external modules
var jwt = require('jsonwebtoken');
var Q = require('q');

// import internal modules
var app = require('./app');
var respond = require('./utils').respond;

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
var notAdmin = 'Bad token (user is not an admin)';
function checkToken (token, mustBeAdmin) {
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
            throw new Error(notAdmin);
        } else {
            return result;
        }
    }, function (err) {
        throw new Error('Bad token (' + err.message + ')');
    });
}

// check the auth token for a web request, respond as appropriate
exports.checkTokenWeb = function (req, res, next, mustBeAdmin) {
    var token = req.get('X-Auth-Token');
    checkToken(token, mustBeAdmin)
    .then(function (result) {
        req.user = {email: result.sub, role: result.role}; // set the user for this request (useful for controllers)
        //res.logUser = req.user;
        next();
    }).catch(function (err) {
        app.logger.warn('Failed to verify token: %s', err.message);
        if (err.message === notAdmin)
            respond(res, 403);
        else
            respond(res, 401);
    }).done();
};

exports.openid = function (req, iss, sub, profile, jwtClaims, accessToken, refreshToken, params, verified) {
    // TODO: set origin to a specific openid server?
    var origin = 'openid';
    app.Account.findOneQ({email: profile._json.email})
    .then(function (user) {
        if (user) {
            // we found a user with this email, proceed to the next step
            return user;
        } else {
            // we didn't find a user for this email, so "register" a new account for them, then proceed to the next step
            // TODO: parse names more elegantly, we can't always assume a name will be formatted like "first last"
            var names = profile.displayName.split(' ');
            var newUser = {
                name_first: names[0],
                name_last: names[1],
                email: profile._json.email,
                origin: origin
            };
            app.logger.debug('Creating OpenID user "%s" for origin "%s"...', newUser.email, newUser.origin);
            return app.Account.createQ(newUser);
        }
    }).then(function (user) {
        if (user.origin === origin) {
            verified(undefined, user); // don't include the optional "info" argument
        } else {
            throw new Error('Tried to use OpenID authentication for a user of a different origin!');
        }
    }).catch(function (error) {
        app.logger.error('Error processing openid user:', error);
    }).done();
};
