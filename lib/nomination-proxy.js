'use strict';

// import external modules
var httpProxySimple = require('http-proxy-simple');
var HTTP = require("q-io/http");
var urlParser = require('url');

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
            var parsed = urlParser.parse(req.url, true);
            var split = parsed.pathname.split('/');
            var resourceType;
            var resourceId;
            switch (req.method.toLowerCase()) {
                case 'put':
                    // these are create/update requests, we must send the appropriate request to the Nomination Service
                    // TODO: hook in nomination service and remove this stub code
                    performRequest(remoteReq);
                    break;
                case 'delete':
                    // requests for Nominate-able resources will look like this:
                    //  * DELETE http://fhir.vacareshare.org/Goal/1452522814664-10000003
                    //  * DELETE http://fhir.vacareshare.org/ProcedureRequest/1452522814664-10000003
                    //  * DELETE http://fhir.vacareshare.org/NutritionOrder/1452522814664-10000003
                    resourceType = split[split.length-2];
                    resourceId = split[split.length-1];

                    // if the request is NOT for a Nominate-able resource, stop and pass it along; otherwise, continue
                    if (resourceType !== 'Goal' && resourceType !== 'ProcedureRequest' && resourceType !== 'NutritionOrder') {
                        performRequest(remoteReq);
                        break;
                    }

                    // these are delete requests, we must send the appropriate request to the Nomination Service
                    if (req.user.isPhysician) {
                        // this is a VA user
                        // TODO: send the request to soft-delete any existing Nominations that delete this resource
                        // then, pass on the request
                        performRequest(remoteReq);
                    } else {
                        // this is a Home Health user
                        // TODO: send the request to create a new Nomination to delete this resource
                        // then, DON'T pass on the request (return a code 200 instead)
                        performRequest(remoteReq); // stub code, remove this after finishing the above TODO
                    }
                    break;
                case 'post':
                    // TODO: completely disallow POST requests?
                    performRequest(remoteReq);
                    break;
                default:
                    // these are read/options requests, pass them along
                    performRequest(remoteReq);
                    break;
            }
        });
    });

    proxy.on('http-intercept-response', function (cid, req, res, remoteRes, remoteResBody, performResponse) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP intercept response');
        switch (req.method.toLowerCase()) {
            case 'get':
                // requests for Nominate-able resources will look like this:
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Agoal
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference
                // when HAPI is updated to support advanced _include queries and CareShare is updated accordingly, requests will look like this:
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Agoal
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference:ProcedureRequest
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference:NutritionOrder
                var parsed = urlParser.parse(req.url, true);
                var split = parsed.pathname.split('/');
                var resourceType = split[split.length-1];
                var carePlanId = parsed.query['_id'];

                // if the request is NOT for a Nominate-able resource, stop and pass it along; otherwise, continue
                if (resourceType !== 'CarePlan' || !carePlanId) {
                    performResponse(remoteRes, remoteResBody);
                    break;
                }

                // these are read requests, we must inject results from the Nomination Service
                var authorId = req.user.isPhysician ? 'all' : req.user.id;
                var urlBase = app.config.get('nomination_service') + '/change-requests/' + carePlanId + '/authors/' + authorId + '/';
                var url;
                try {
                    // if parsing JSON fails, catch the error and proxy the response through
                    var body = JSON.parse(remoteResBody.toString('utf8'));

                    if (parsed.query['_include'] === 'CarePlan:goal') {
                        // this is a request for Goals
                        url = urlBase + 'goals';
                        // TODO: get nominations for Goals and inject them into the body
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference') {
                        // this is a request for ProcedureRequests and NutritionOrders
                        url = urlBase + 'procedure-requests';
                        // TODO: get nominations for ProcedureRequests and inject them into the body
                        url = urlBase + 'nutrition-orders';
                        // TODO: get nominations for NutritionOrders and inject them into the body

                        // TODO: remove this when HAPI is updated to support advanced _include queries and CareShare is updated accordingly
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference:ProcedureRequest') {
                        // this is a request for ProcedureRequests (Interventions)
                        url = urlBase + 'procedure-requests';
                        // TODO: implement this when HAPI is updated to support advanced _include queries and CareShare is updated accordingly
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference:NutritionOrder') {
                        // this is a request for NutritionOrders (Nutrition)
                        url = urlBase + 'nutrition-orders';
                        // TODO: implement this when HAPI is updated to support advanced _include queries and CareShare is updated accordingly
                    }

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
                // these are responses to create/update/delete/options requests, pass them along
                performResponse(remoteRes, remoteResBody);
                break;
        }
    });
};
