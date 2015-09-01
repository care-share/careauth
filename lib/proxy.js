'use strict';

// import external modules
var express = require('express');
var http = require('http');
var httpProxy = require('http-proxy');
var Q = require('q');

// import internal modules
var auth = require('./auth');
var respond = require('./utils').respond;

module.exports.init = function(app) {
    // get config info
    var port = app.config.get('port');
    // we have to create a "proxy table": https://blog.nodejitsu.com/node-http-proxy-1dot0/
    var options = app.config.proxyOptions();

    // debug logger
    var morgan = require('morgan');
    morgan.token('remote-user', function(req, res){
        if (req.user)
            return req.user.email;
        return 'null';
    });
    morgan.token('message', function(req, res) {
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

    // create an Express server so we can use middleware with our proxy
    var server = express()
    // allow CORS
    // TODO: edit to limit domains instead of using a wildcard
    .use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Auth-Token, X-Requested-With, Content-Type, Accept,Destroy');
        res.header('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT'); // don't need HEAD, OPTIONS, or TRACE
        next();
    })
    .use(morgan(morganFormat, morganOptions))
    .use(onBeforeProxy)
    .use(doProxy);

    // start the Express server reverse proxy
    http.createServer(server).listen(port, function() {
        app.logger.info('Proxy server listening on port %d, proxy table:', port, JSON.stringify(options, null, 2));
    });

    // middleware to check tokens for connections to the FHIR server
    var regex = new RegExp("^fhir");
    function onBeforeProxy (req, res, next) {
        // use compiled regex to check if this client is trying to access the FHIR server
        if (regex.test(req.headers.host)) {
            // they are trying to access the FHIR server, instruct Morgan to log this request
            req.logThis = true;
            // now let's authenticate their token
            auth.checkTokenWeb(req, res, next);
        } else {
            // they aren't trying to access the FHIR server, just proxy the request through
            next();
        }
    }

    // middleware to actually perform reverse proxying
    var proxy = httpProxy.createProxy();
    function doProxy (req, res) {
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

