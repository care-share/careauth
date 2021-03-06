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
var passportLocalMongoose = require('passport-local-mongoose');

// import internal modules
var app = require('../app');
var auth = require('../auth');

module.exports = Account;

function Account(mongoose) {
    var Token = new mongoose.Schema({
        token: {type: String},
        date_created: {type: Date, default: Date.now}
    });
    Token.statics.hasExpired = function (created) {
        var now = new Date();
        var diff = (now.getTime() - created);
        return diff > app.config.get('jwt_ttl');
    };
    var TokenModel = mongoose.model('Token', Token);

    var Account = new mongoose.Schema({
        email: {type: String, required: true, lowercase: true, index: {unique: true}},
        name_first: {type: String, required: true},
        name_last: {type: String, required: true},
        roles: {
            type: [
                {
                    type: String,
                    enum: ['user', 'admin', 'physician']
                }
            ], default: ['user']
        },
        fhir_id: {type: String},
        contact_pref: {type: String},
        phone: {type: String},
        picture: {type: String, default: 'default_picture.jpg'},
        origin: {type: String, default: 'local'}, // if this is "openid" we won't need a password
        approved: {type: Boolean, default: false},
        date_created: {type: Date, default: Date.now},
        token: {type: Object},
        //For reset we use a reset token with an expiry (which must be checked)
        reset_token: {type: String},
        reset_token_expires_millis: {type: Number}
    });

    // integrate passport-local (handles password/etc), use the "email" field as the user's username
    Account.plugin(passportLocalMongoose, {usernameField: 'email'});

    Account.statics.createUserToken = function (email) {
        var that = this;
        return this.findOneQ({email: email}, app.config.get('user_filter'))
            .then(function (user) {
                return auth.makeToken(user)
                    .then(function (token) {
                        return that.updateToken(user, token);
                    });
                //.then(user.updateToken);
            });
    };

    Account.statics.invalidateUserToken = function (email) {
        var that = this;
        return this.findOneQ({email: email})
            .then(function (user) {
                return that.updateToken(user, undefined);
                //return user.updateToken(undefined);
            });
    };

    Account.statics.updateToken = function (user, token) {
        if (token !== undefined)
            user.token = new TokenModel({token: token});
        else
            user.token = undefined;
        return user.saveQ();
    };
    // this should $#(%ing work, but for some reason, it results in 'this' being undefined... using a static instead
    //Account.methods.updateToken = function (token) {
    //    if (token !== undefined)
    //        this.token = new TokenModel({token: token});
    //    else
    //        this.token = undefined;
    //    return this.saveQ();
    //};

    var AccountModel = mongoose.model('Account', Account);
    AccountModel.Token = TokenModel;

    return AccountModel;
}
