'use strict';

// import external modules
var httpProxySimple = require('http-proxy-simple');

// forward proxy for intercepting requests to the FHIR server and applying Nomination data
// adapted from https://github.com/rse/node-http-proxy-simple#usage
module.exports.init = function (app) {
    var proxy = httpProxySimple.createProxyServer({
        host: '0.0.0.0',
        port: 3002
    });

    proxy.on('connection-open', function (cid, socket) {
        //app.logger.debug('proxy: ' + cid + ': TCP connection open');
    });

    proxy.on('connection-error', function (cid, socket, error) {
        //app.logger.debug('proxy: ' + cid + ': TCP connection error: ' + error);
    });

    proxy.on('connection-close', function (cid, socket, had_error) {
        //app.logger.debug('proxy: ' + cid + ': TCP connection close');
    });

    proxy.on('http-request', function (cid, request, response) {
        //app.logger.debug('proxy: ' + cid + ': HTTP request: ' + request.url);
    });

    proxy.on('http-error', function (cid, error, request, response) {
        app.logger.error('nomination-proxy: ' + cid + ': HTTP error: ' + error);
    });

    proxy.on('http-intercept-request', function (cid, request, response, remoteRequest, performRequest) {
        //app.logger.debug('proxy: ' + cid + ': HTTP intercept request');
        switch (request.method.toLowerCase()) {
            case 'post': // TODO: completely disallow POST requests?
            case 'put':
            case 'delete':
                // these are create/update/delete requests, we must send the appropriate request to the Nomination Service
                // TODO: hook in nomination service and remove this stub code
                performRequest(remoteRequest);
                break;
            default:
            case 'get':
            case 'options':
                // these are read requests, pass them along
                performRequest(remoteRequest);
                break;
        }
    });

    proxy.on('http-intercept-response', function (cid, request, response, remoteResponse, remoteResponseBody, performResponse) {
        //app.logger.debug('proxy: ' + cid + ': HTTP intercept response');
        switch (request.method.toLowerCase()) {
            case 'get':
            case 'options':
                // these are read requests, we must inject results from the Nomination
                // TODO: hook in nomination service and remove this stub code
                performResponse(remoteResponse, remoteResponseBody);
                break;
            default:
            case 'post': // TODO: completely disallow POST requests?
            case 'put':
            case 'delete':
                // these are responses to create/update/delete requests, pass them along
                performResponse(remoteResponse, remoteResponseBody);
                break;
        }
    });
};
