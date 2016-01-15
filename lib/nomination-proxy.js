'use strict';

// import external modules
var httpProxySimple = require('http-proxy-simple');
var HTTP = require('q-io/http');
var urlParser = require('url');
var Q = require('q');

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
        var parsed = urlParser.parse(req.url, true);
        var split = parsed.pathname.split('/');
        var method = req.method.toLowerCase();
        var resourceType;
        var resourceId;
        var isNewResource = false;

        function interceptCreateOrUpdate () {
            Q.fcall(function () {
                return JSON.parse(req.body);
            }).then(function (body) {
                var carePlanId = body.carePlanId;
                if (!carePlanId) {
                    throw new Error('Model does not contain carePlanId');
                }
                if (req.user.isPhysician) {
                    // delete any nominations if needed
                    var accepted = body.acceptedNominations;
                    var rejected = body.rejectedNominations;
                    resolveNominations(carePlanId, resourceId, 'accepted', accepted);
                    resolveNominations(carePlanId, resourceId, 'rejected', rejected);
                } else {
                    // create a nomination for this request
                    var url = app.config.get('proxy_fhir') + '/' + resourceType + '/' + resourceId;
                    app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        return {action: 'update', existing: result, proposed: body};
                    }, function (err) {
                        if (err.response.status === 404) {
                            // this is a 404 error, the resourceId does not exist yet (so this is a create)
                            isNewResource = true;
                            body.id = resourceId; // this is not present in a regular FHIR request...
                            // FIXME: loop through and remove Ember IDs for child objects in the body?
                            return {action: 'create', existing: {}, proposed: body};
                        }
                        // this is a different error...
                        throw new Error('Error when contacting FHIR server: ' + err.message);
                    }).then(function (nomination) {
                        var url = app.config.get('nomination_service') + '/care-plans/' + carePlanId + '/authors/'
                            + req.user.id + '/' + dasherize(resourceType) + 's/' + resourceId;
                        app.logger.verbose('nomination-proxy: Making request to nomination service: PUT', url);
                        return {
                            url: url,
                            method: 'PUT',
                            headers: {'Content-Type': 'application/json'},
                            body: [JSON.stringify(nomination)]
                        };
                    }).then(HTTP.request);
                }
            }).fail(function (err) {
                // catch rejections so they don't throw "real" errors
                app.logger.error('nomination-proxy: Failed to intercept PUT request:', err);
            }).fin(generateResponse).done();
        }

        function interceptDelete() {
            Q.fcall(function () {
                if (req.user.isPhysician) {
                    // resolve ALL nominations for this resource
                    // results in this request to the Nomination Service:
                    // DELETE /care-plans/all/authors/all/resources/{resourceId}
                    resolveNominations('all', resourceId, 'cascade-deleted', ['all']);
                } else {
                    // create a nomination for this request
                    var revInclude = 'activityreference'; // for ProcedureRequest and NutritionOrder
                    if (resourceType === 'Goal') {
                        revInclude = 'goal';
                    }
                    var url = app.config.get('proxy_fhir') + '/' + resourceType + '?_id=' + resourceId + '&_format=json&_revinclude=CarePlan:' + revInclude;
                    app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        if (result.entry.length !== 2) {
                            throw new Error('Made request to FHIR server: "' + url + '", unexpected result! array length = ' + result.entry.length);
                        }
                        var carePlanIsFirst = result.entry[0].resourceType === 'CarePlan';
                        var existing = result.entry[carePlanIsFirst ? 1 : 0].resource;
                        var carePlanId = result.entry[carePlanIsFirst ? 0 : 1].resource.id;
                        return {existing: existing, carePlanId: carePlanId};
                    }).then(function (result) {
                        // make an HTTP request to the nomination service to create a new nomination to delete the given resource
                        var nomination = {
                            action: 'delete',
                            existing: result.existing,
                            proposed: {}
                        };
                        var url = app.config.get('nomination_service') + '/care-plans/' + result.carePlanId + '/authors/' + req.user.id + '/' + dasherize(resourceType) + 's/' + resourceId;
                        app.logger.verbose('nomination-proxy: Making request to nomination service: PUT', url);
                        return {
                            url: url,
                            method: 'PUT',
                            headers: {'Content-Type': 'application/json'},
                            body: [JSON.stringify(nomination)]
                        };
                    }).then(HTTP.request);
                }
            }).fail(function (err) {
                // catch rejections so they don't throw "real" errors
                app.logger.error('nomination-proxy: Failed to intercept DELETE request:', err);
            }).fin(generateResponse).done();
        }

        var generateResponse = function () {
            app.logger.silly('nomination-proxy: Generating response to %s request, isPhysician:', method.toUpperCase(), req.user.isPhysician);
            if (req.user.isPhysician) {
                // for physicians, pass the original request along
                performRequest(remoteReq);
            } else {
                // for Home Health users, generate a fake outcome
                if (method === 'put') {
                    var string = '{"resourceType":"OperationOutcome"}';
                    res.writeHead(isNewResource ? 201 : 200, {
                        'Content-Length': string.length,
                        'Content-Type': 'application/json' });
                    res.end(string);
                } else { // delete
                    res.writeHead(204,{}); // No Content
                    res.end();
                }
            }
        };

        auth.checkTokenWeb(req, res, function() {
            // TODO: change method of determining whether a user is a physician / primary care?
            req.user.isPhysician = req.user.roles.indexOf('physician') > -1;
            switch (method) {
                case 'put':
                case 'delete':
                    // requests for Nominate-able resources will look like this:
                    //  * PUT http://fhir.vacareshare.org/Goal/1452522814664-10000003
                    //  * PUT http://fhir.vacareshare.org/ProcedureRequest/1452522814664-10000003
                    //  * PUT http://fhir.vacareshare.org/NutritionOrder/1452522814664-10000003
                    //  * DELETE http://fhir.vacareshare.org/Goal/1452522814664-10000003
                    //  * DELETE http://fhir.vacareshare.org/ProcedureRequest/1452522814664-10000003
                    //  * DELETE http://fhir.vacareshare.org/NutritionOrder/1452522814664-10000003
                    resourceType = split[split.length-2];
                    resourceId = split[split.length-1].split('?')[0];

                    // if the request is NOT for a Nominate-able resource, stop and pass it along; otherwise, continue
                    if (resourceType !== 'Goal' && resourceType !== 'ProcedureRequest' && resourceType !== 'NutritionOrder') {
                        // if the user is not a physician, we don't actually let them do PUT/DELETE requests
                        generateResponse();
                        break;
                    }

                    if (method === 'put') {
                        // these are create/update requests, we must send the appropriate request to the Nomination Service
                        interceptCreateOrUpdate();
                        break;
                    }

                    // these are delete requests, we must send the appropriate request to the Nomination Service
                    interceptDelete();
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
                // TODO: add support for GET-ing specific Nominate-able resources (e.g. GET http://.../Goal/123)
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
                var urlBase = app.config.get('nomination_service') + '/care-plans/' + carePlanId + '/authors/' + authorId + '/';
                var body;

                // define this promise here so it has access to variables in the local scope
                var injectNominationResponse = function (resType) {
                    var url = urlBase + dasherize(resType) + 's';
                    app.logger.verbose('nomination-proxy: Making request to nomination service: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        // result is a JSON array
                        var create = [];
                        var updateOrDelete = {};
                        var resId;
                        // loop through the nomination data and transform it
                        for (var i = 0; i < result.length; i++) {
                            if (result[i].action === 'create') {
                                create.push(result[i]);
                            } else { // action should be 'update' or 'delete'
                                resId = result[i].resourceId;
                                if (updateOrDelete[resId] === undefined) {
                                    updateOrDelete[resId] = [];
                                }
                                updateOrDelete[resId].push(result[i]);
                            }
                        }
                        // loop through the FHIR response body and inject the nomination data
                        var resource;
                        var nominations;
                        // inject updates/deletes
                        for (var i = 0; i < body.entry.length; i++) {
                            resource = body.entry[i].resource;
                            if (resource.resourceType !== resType) {
                                // if this resource is a different type, skip it
                                continue;
                            }
                            nominations = updateOrDelete[resource.id];
                            if (nominations === undefined) {
                                nominations = [];
                            }
                            resource.nominations = nominations;
                        }
                        // inject creates
                        var createObj;
                        for (var i = 0; i < create.length; i++) {
                            createObj = create[i].proposed;
                            create[i].proposed = {};
                            createObj.nominations = [create[i]];
                            body.entry.push({
                                resource: createObj
                            });
                        }
                    }).fail(function (err) {
                        app.logger.error('nomination-proxy: Failed to get nominations for %s:', resType, err);
                        return Q.reject(); // return a rejection so we jump to the finish routine
                    });
                };

                Q.fcall(function () {
                    // if parsing JSON fails, catch the error and proxy the response through
                    body = JSON.parse(remoteResBody.toString('utf8'));
                }).fail(function (err) {
                    app.logger.error('nomination-proxy: Failed to parse JSON body of FHIR response:', err);
                    return Q.reject(); // return a rejection so we jump to the finish routine
                }).then(function () {
                    if (parsed.query['_include'] === 'CarePlan:goal') {
                        // this is a request for Goals
                        return injectNominationResponse('Goal');
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference') {
                        // this is a request for ProcedureRequests and NutritionOrders
                        return injectNominationResponse('ProcedureRequest')
                            .thenResolve('NutritionOrder')
                            .then(injectNominationResponse);
                        // TODO: remove this when HAPI is updated to support advanced _include queries and CareShare is updated accordingly
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference:ProcedureRequest') {
                        // this is a request for ProcedureRequests (Interventions)
                        return injectNominationResponse('ProcedureRequest');
                    } else if (parsed.query['_include'] === 'CarePlan:activityreference:NutritionOrder') {
                        // this is a request for NutritionOrders (Nutrition)
                        return injectNominationResponse('NutritionOrder');
                    }
                }).then(function () {
                    // if we made it this far without any errors, apply changes to remoteResBody
                    remoteResBody = JSON.stringify(body);
                    remoteRes.headers['content-length'] = remoteResBody.length;
                }).fail(function (err) {
                    // catch rejections so they don't throw "real" errors
                }).fin(function () {
                    // pass the response back to the client
                    performResponse(remoteRes, remoteResBody);
                });
                break;
            default:
                // these are responses to create/update/delete/options requests, pass them along
                performResponse(remoteRes, remoteResBody);
                break;
        }
    });

    function resolveNominations(carePlanId, resourceId, resolution, authorIds) {
        var prefix = app.config.get('nomination_service') + '/care-plans/' + carePlanId + '/authors/';
        var suffix = '/resources/' + resourceId;

        if (authorIds && authorIds.constructor === Array) {
            for (var i = 0; i < authorIds.length; i++) {
                var url = prefix + authorIds[i] + suffix;
                app.logger.verbose('nomination-proxy: Making request to nomination service: DELETE %s (nomination %s)', url, resolution);
                // TODO: implement resolution
                HTTP.request({
                    url: url,
                    method: 'DELETE'
                }).fail(function (err) {
                    app.logger.error('nomination-proxy: Failed to make request to nomination service!', err);
                }).done();
            }
        }
    }

    function dasherize (value) {
        return value.replace(/[A-Z]/g, function(char, index) {
            return (index !== 0 ? '-' : '') + char.toLowerCase();
        });
    }
};
