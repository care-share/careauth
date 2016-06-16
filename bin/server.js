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
var bodyParser = require('body-parser');
var express = require('express');
var passport = require('passport');
var passportOpenID = require('openidconnect-for-passport');

// import internal modules
var app = require('../lib/app');
var reverseProxy = require('../lib/reverse-proxy');
var nominationProxy = require('../lib/nomination-proxy');
var routes = require('../app/routes/api');

// initialize the app object
app.init();

var server = express();

// allow CORS
// TODO: edit to limit domains instead of using a wildcard
server.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Auth-Token, X-Requested-With, Content-Type, Accept,Destroy');
    res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT'); // don't need HEAD, OPTIONS, or TRACE
    next();
});

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({extended: true}));

// debug logger
var morgan = require('morgan');
morgan.token('remote-user', function (req, res) {
    if (req.user)
        return req.user.id;
    return 'null';
});
morgan.token('message', function (req, res) {
    return res.logMessage;
});
server.use(morgan(':remote-addr - :remote-user ":method :url" :status ":message"', {stream: app.logger.stream}));

server.use(passport.initialize());

// plug in Passport local strategy
passport.use(app.Account.createStrategy());

// plug in Passport OpenID Connect strategy
var options = app.config.openidParameters();
var verify = require('../lib/auth').openid;
passport.use(new passportOpenID.Strategy(options, verify));

// make sure passport doesn't blow up
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

routes(server, passport);

// serve static webpage files
server.use(express.static('public'));


var port = 3001;
server.listen(port, function () {
    app.logger.info('Express server listening on port %d', port);
});

// start up the reverse proxy
reverseProxy.init(app);

// start up the nomination proxy
nominationProxy.init(app);
