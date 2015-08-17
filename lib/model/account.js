'use strict';

// import external modules
var passportLocalMongoose = require('passport-local-mongoose');

// import internal modules
var app = require('../app');
var auth = require('../auth');

module.exports = Account;

function Account(mongoose, config) {
    var Token = new mongoose.Schema({
        token: {type: String},
        date_created: {type: Date, default: Date.now}
    });
    Token.statics.hasExpired= function(created) {
        var now = new Date();
        var diff = (now.getTime() - created);
        return diff > config.get('jwt_ttl');
    };
    var TokenModel = mongoose.model('Token', Token);

    var Account = new mongoose.Schema({
        email: { type: String, required: true, lowercase:true, index: { unique: true } },
        name_first: {type: String, required: true},
        name_last: {type: String, required: true},
        role: {type: String, default: 'user'},
        approved: {type: Boolean, default: false},
        date_created: {type: Date, default: Date.now},
        token: {type: Object},
        //For reset we use a reset token with an expiry (which must be checked)
        reset_token: {type: String},
        reset_token_expires_millis: {type: Number}
    });
    Account.plugin(passportLocalMongoose, {usernameField: 'email'});

    Account.statics.findUser = function(email, token, cb) {
        var self = this;
        this.findOne({email: email}, function(err, usr) {
            if(err || !usr) {
                cb(err, null);
            } else if (usr.token && usr.token.token && token === usr.token.token) {
                cb(false, {email: usr.email, token: usr.token, date_created: usr.date_created, name_first: usr.name_first, name_last: usr.name_last, role: usr.role});
            } else {
                cb(new Error('Token does not exist or does not match.'), null);
            }
        });
    };

    Account.statics.findUserByEmailOnly = function(email, cb) {
        var self = this;
        this.findOne({email: email}, function(err, usr) {
            if(err || !usr) {
                cb(err, null);
            } else {
                cb(false, usr);
            }
        });
    };
    Account.statics.createUserToken = function(email, cb) {
        var self = this;
        this.findOne({email: email}, function(err, usr) {
            if(err || !usr) {
                console.log('err');
            }
            //Create a token and add to user and save
            auth.makeToken(usr)
            .then(function (result) {
                usr.token = new TokenModel({token:result});
                usr.save(function(err, usr) {
                    if (err) {
                        cb(err, null);
                    } else {
                        //console.log("about to cb with usr.token.token: " + usr.token.token);
                        cb(undefined, usr.token.token);//token object, in turn, has a token property :)
                    }
                });
            }).catch(function (err) {
                cb(err);
            }).done();
        });
    };

    Account.statics.invalidateUserToken = function(email, cb) {
        var self = this;
        this.findOne({email: email}, function(err, usr) {
            if(err || !usr) {
                console.log('err');
            }
            usr.token = null;
            usr.save(function(err, usr) {
                if (err) {
                    cb(err, null);
                } else {
                    cb(false, 'removed');
                }
            });
        });
    };

    var AccountModel = mongoose.model('Account', Account);
    AccountModel.Token = TokenModel;
    return AccountModel;
}
