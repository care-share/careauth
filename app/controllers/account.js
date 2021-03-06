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
                _id: req.user._id,
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
