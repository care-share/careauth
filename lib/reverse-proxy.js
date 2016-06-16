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
var express = require('express');
var httpProxy = require('http-proxy');
var Q = require('q');

// import internal modules
var auth = require('./auth');
var respond = require('./utils').respond;

module.exports.init = function (app) {
    // get config info
    var port = app.config.get('port');
    // we have to create a "proxy table": https://blog.nodejitsu.com/node-http-proxy-1dot0/
    var options = app.config.proxyOptions();

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
    var morganFormat = ':remote-addr - :remote-user ":method fhir.' + app.config.get('domain') + ':url" :status ":message"';
    var morganOptions = {
        stream: app.logger.stream,
        skip: function (req, res) {
            // only log requests that were made to the FHIR server
            return !req.logThis;
        }
    };

    // create an Express server so we can use middleware with our reverse proxy
    var server = express()
    // allow CORS
    // TODO: edit to limit domains instead of using a wildcard
        .use(function (req, res, next) {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Auth-Token, X-Requested-With, Content-Type, Accept,Destroy');
            res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT'); // don't need HEAD, OPTIONS, or TRACE
            next();
        })
        .use(morgan(morganFormat, morganOptions))
        .use(onBeforeProxy)
        .use(doProxy);

    var tls = app.config.get('use_tls') == 'true';
    var serverCB = function () {
        app.logger.info('HTTP%s proxy server listening on port %d, proxy table: %s',
            tls ? 'S' : '', port, JSON.stringify(options, null, 2));
    };

    // start the Express server reverse proxy
    if (tls) {
        var https = require('https');
        var tlsOptions = app.config.get('tls_options');
        var tlsServer = https.createServer(tlsOptions, server);
        tlsServer.listen(port, serverCB);

        if (port == '443') {
            // we're listening on the standard HTTPS port (443)
            // redirect from the standard HTTP port (80) to HTTPS
            var http = require('http');
            http.createServer(function (req, res) {
                res.writeHead(301, {"Location": "https://" + req.headers['host'] + req.url});
                res.end();
            }).listen(80);
        }
    } else {
        server.listen(port, serverCB);
    }

    // middleware to check tokens for connections to the FHIR server
    var regex = new RegExp("^fhir");

    function onBeforeProxy(req, res, next) {
        // use compiled regex to check if this client is trying to access the FHIR server
        if (req.method === "OPTIONS") {
            // respond OK to all options requests
            // this is needed so browsers don't puke on themselves when doing ajax/XHR preflight requests for CORS
            respond(res, 200);
        } else if (regex.test(req.headers.host)) {
            // they are trying to access the FHIR server, instruct Morgan to log this request
            req.logThis = true;
            // now let's authenticate their token
            auth.checkTokenWeb(req, res, function () {
                var user = req.user;
                // TODO: Should we look up the user in the database? Otherwise an old token may not have correct roles... probably a non-issue
                var url = req.originalUrl.split('?')[0];
                var resource = url.split('/').slice(0, 2).join('/');
                // so "/Medication/foo/bar/baz" will result in "/Medication"

                //app.acl.areAnyRolesAllowed(user.roles, resource, req.method.toLowerCase(), function (err, result) {
                //    if (err) {
                //        app.logger.error('FHIR authorization- failed when trying to authorize user "%s" with roles %s to access resource "%s": %s', user.id, JSON.stringify(user.roles), resource, err.message);
                //        respond(res, 500);
                //    } else if (!result) {
                //        app.logger.verbose('FHIR authorization- user "%s" has roles %s and is unauthorized to access resource "%s"', user.id, JSON.stringify(user.roles), resource);
                //        respond(res, 403);
                //    } else {
                        // forward this request to our nomination proxy
                        var split = req.headers.host.split(':');
                        var urlPrefix = options[split[0]]; // trim off port if it's present, before looking up target
                        req.url = urlPrefix + req.url;
                        var target = 'http://localhost:3002';
                        app.logger.silly('Proxying request from "%s" to "%s"', req.headers.host, target);
                        Q.ninvoke(proxy, 'web', req, res, {target: target, toProxy: true, prependPath: false})
                            .catch(function (err) {
                                app.logger.error('Failed to proxy request from "%s" to "%s": %s', req.headers.host, target, err.message);
                                respond(res, 500);
                            }).done();
                //    }
                //})
            });
        } else {
            // they aren't trying to access the FHIR server, just proxy the request through
            next();
        }
    }

    // middleware to actually perform reverse proxying
    var proxy = httpProxy.createProxy();

    function doProxy(req, res) {
        var split = req.headers.host.split(':');
        var target = options[split[0]]; // trim off port if it's present, before looking up target
        //app.logger.silly('Proxying request from "%s" to "%s"', req.headers.host, target);
        Q.ninvoke(proxy, 'web', req, res, {target: target})
            .catch(function (err) {
                app.logger.error('Failed to proxy request from "%s" to "%s": %s', req.headers.host, target, err.message);
                respond(res, 500);
            }).done();
    }
};

