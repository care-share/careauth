'use strict';

// import external modules
var httpProxySimple = require('http-proxy-simple');
var url = require('url');

// import internal modules
var auth = require('./auth');

// forward proxy for intercepting requests to the FHIR server and applying Nomination data
// adapted from https://github.com/rse/node-http-proxy-simple#usage
module.exports.init = function (app) {
    var proxy = httpProxySimple.createProxyServer({
        host: '0.0.0.0',
        port: 3002
    });

    proxy.on('connection-open', function (cid, socket) {
        //app.logger.debug('nomination-proxy: ' + cid + ': TCP connection open');
    });

    proxy.on('connection-error', function (cid, socket, error) {
        //app.logger.debug('nomination-proxy: ' + cid + ': TCP connection error: ' + error);
    });

    proxy.on('connection-close', function (cid, socket, had_error) {
        //app.logger.debug('nomination-proxy: ' + cid + ': TCP connection close');
    });

    proxy.on('http-request', function (cid, req, res) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP request: ' + req.url);
    });

    proxy.on('http-error', function (cid, error, req, res) {
        app.logger.error('nomination-proxy: ' + cid + ': HTTP error: ' + error);
    });

    proxy.on('http-intercept-request', function (cid, req, res, remoteReq, performRequest) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP intercept request');
        auth.checkTokenWeb(req, res, function() {
            // TODO: change method of determining whether a user is a physician / primary care?
            req.user.isPhysician = req.user.roles.indexOf('physician') > -1;
            switch (req.method.toLowerCase()) {
                case 'post': // TODO: completely disallow POST requests?
                case 'put':
                case 'delete':
                    // these are create/update/delete requests, we must send the appropriate request to the Nomination Service
                    // TODO: hook in nomination service and remove this stub code
                    performRequest(remoteReq);
                    break;
                default:
                case 'get':
                case 'options':
                    // these are read requests, pass them along
                    performRequest(remoteReq);
                    break;
            }
        });
    });

    proxy.on('http-intercept-response', function (cid, req, res, remoteRes, remoteResBody, performResponse) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP intercept response');
        switch (req.method.toLowerCase()) {
            case 'get':
            case 'options':
                // these are read requests, we must inject results from the Nomination Service
                try {
                    // if parsing JSON fails, catch the error and proxy the response through
                    var body = JSON.parse(remoteResBody.toString('utf8'));

                    // TODO: hook in nomination service and remove this stub code
                    // stub code: add property to body
                    body.foo = 'bar';

                    // apply changes to remoteResBody
                    remoteResBody = JSON.stringify(body);
                    remoteRes.headers['content-length'] = remoteResBody.length;
                } catch (err) {
                    app.logger.error('Failed to parse JSON body of FHIR response:', err);
                } finally {
                    performResponse(remoteRes, remoteResBody);
                }
                break;
            default:
            case 'post': // TODO: completely disallow POST requests?
            case 'put':
            case 'delete':
                // these are responses to create/update/delete requests, pass them along
                performResponse(remoteRes, remoteResBody);
                break;
        }
    });
};
