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
        var split = parsed.pathname.split('baseDstu2')[1].split('/');
        var method = req.method.toLowerCase();
        var resourceType = split[1];
        var resourceId;
        var isNewResource = false;
        var body;

        function interceptCreateOrUpdate() {
            Q.fcall(function () {
                body = JSON.parse(req.body);
            }).then(function () {
                var carePlanId = body.carePlanId;
                var patientId = body.patientId;
                if (!carePlanId) {
                    throw new Error('Model does not contain carePlanId');
                } else if (!patientId) {
                    throw new Error('Model does not contain patientId');
                }
                if (req.user.isPhysician) {
                    // resolve specified nominations for this resource
                    // results in request(s) to the Nomination Service:
                    // DELETE /nominations/id/{id}
                    var accepted = body.acceptedNominations; // list of nomination IDs we have accepted for this resource
                    var rejected = body.rejectedNominations; // list of nomination IDs we have rejected for this resource
                    resolveNominations('accepted', accepted);
                    resolveNominations('rejected', rejected);
                } else {
                    // create a nomination for this request
                    var url = app.config.get('proxy_fhir') + '/' + resourceType + '/' + resourceId + '?_format=json';
                    app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        return {action: 'update', existing: result};
                    }, function (err) {
                        if (err.response.status === 404) {
                            // this is a 404 error, the resourceId does not exist yet (so this is a create)
                            isNewResource = true;
                            body.id = resourceId; // this is not present in a regular FHIR request...
                            // FIXME: loop through and remove Ember IDs for child objects in the body?
                            return {action: 'create', existing: {}};
                        }
                        // this is a different error...
                        throw new Error('Error when contacting FHIR server: ' + err.message);
                    }).then(function (result) {
                        return {
                            authorId: req.user.id,
                            resourceId: resourceId,
                            carePlanId: carePlanId,
                            patientId: patientId,
                            resourceType: dasherize(resourceType),
                            action: result.action,
                            existing: result.existing,
                            proposed: body
                        };
                    }).then(createNomination);
                }
            }).then(function() {
                // remove these attributes so HAPI FHIR doesn't explode...
                delete body.carePlanId;
                delete body.patientId;
                delete body.nominations;
                delete body.acceptedNominations;
                delete body.rejectedNominations;
                // apply the new body string to the request
                remoteReq.body = JSON.stringify(body);
                remoteReq.headers['content-length'] = body.length;
            }).fail(function (err) {
                // catch rejections so they don't throw "real" errors
                app.logger.error('nomination-proxy: Failed to intercept PUT request:', err);
            }).fin(generateResponse).done();
        }

        function interceptDelete() {
            // TODO: what if a physician wants to delete a nomination? what if a home health user wants to delete a nomination?
            // perhaps we should check to see if the resource exists first and then act accordingly...
            Q.fcall(function () {
                if (req.user.isPhysician) {
                    // resolve ALL nominations for this resource
                    // results in this request to the Nomination Service:
                    // DELETE /nominations/resource-id/{resourceId}
                    resolveAllNominations(resourceId, 'cascade-deleted');
                } else {
                    // create a nomination for this request
                    var revInclude;
                    if (resourceType === 'Goal') {
                        revInclude = 'goal';
                    } else if (resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                        revInclude = 'activityreference';
                    }
                    var url = app.config.get('proxy_fhir') + '/' + resourceType + '?_id=' + resourceId + '&_format=json&_revinclude=CarePlan:' + revInclude;
                    app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        if (result.entry.length !== 2) {
                            throw new Error('Made GET request to FHIR server, unexpected result! array length = ' + result.entry.length);
                        }
                        var carePlanIsFirst = result.entry[0].resourceType === 'CarePlan';
                        var carePlan = result.entry[carePlanIsFirst ? 0 : 1].resource;
                        var existing = result.entry[carePlanIsFirst ? 1 : 0].resource;
                        var carePlanId = carePlan.id;
                        var patientId = carePlan.subject.reference.split('/')[1];
                        return {
                            authorId: req.user.id,
                            resourceId: resourceId,
                            carePlanId: carePlanId,
                            patientId: patientId,
                            resourceType: dasherize(resourceType),
                            action: 'delete',
                            existing: existing,
                            proposed: {}
                        };
                    }).then(createNomination);
                }
            }).fail(function (err) {
                // catch rejections so they don't throw "real" errors
                app.logger.error('nomination-proxy: Failed to intercept DELETE request:', err);
            }).fin(generateResponse).done();
        }

        function createNomination(nomination) {
            // carePlanId is passed up from the PUT request from CareShare to inform us what attribute to add to the
            // nomination; however, that attribute should not be part of the proposed object
            nomination.proposed.carePlanId = undefined;

            var url = app.config.get('nomination_service') + '/nominations';
            app.logger.verbose('nomination-proxy: Making request to nomination service: PUT %s (authorId: %s, resourceId: %s, carePlanId: %s, patientId: %s)',
                url, nomination.authorId, nomination.resourceId, nomination.carePlanId, nomination.patientId);

            var bodyString = JSON.stringify(nomination, stringifyReplacer, 2);
            return HTTP.request({
                url: url,
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: [bodyString]
            });
        }

        function generateResponse() {
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
                        'Content-Type': 'application/json'
                    });
                    res.end(string);
                } else { // delete
                    res.writeHead(204, {}); // No Content
                    res.end();
                }
            }
        }

        auth.checkTokenWeb(req, res, function () {
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
                    resourceId = split[2].split('?')[0];

                    if (resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                        if (method === 'put') {
                            // these are create/update requests, we must send the appropriate request to the Nomination Service
                            interceptCreateOrUpdate();
                        } else if (method === 'delete') {
                            // these are delete requests, we must send the appropriate request to the Nomination Service
                            interceptDelete();
                        }
                        break;
                    } else {
                        // the request is NOT for a Nominate-able resource, pass it along
                        generateResponse();
                    }
                    break;
                case 'post':
                    // TODO: completely disallow POST requests?
                    performRequest(remoteReq);
                    break;
                case 'get':
                    if (resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                        // remove headers that may cause the FHIR server to respond with a code 304
                        delete remoteReq.headers['if-modified-since'];
                        delete remoteReq.headers['if-none-match'];
                    }
                default:
                    // these are read/options requests, pass them along
                    performRequest(remoteReq);
                    break;
            }
        });
    });

    proxy.on('http-intercept-response', function (cid, req, res, remoteRes, remoteResBody, performResponse) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP intercept response');
        var parsed = urlParser.parse(req.url, true);
        var split = parsed.pathname.split('baseDstu2')[1].split('/');
        var method = req.method.toLowerCase();
        var carePlanId;
        var authorId = req.user.isPhysician ? '' : '/author-id/' + req.user.id;
        var resourceType = split[1];
        var resourceId;
        var body; // body of response

        function interceptReadOne() {
            resourceId = split[2];
            Q.fcall(function () {
                if (remoteRes.statusCode === 404) {
                    // this FHIR resource doesn't exist, it may be a nomination
                    var url = app.config.get('nomination_service') + '/nominations/resource-id/' + resourceId;
                    app.logger.verbose('nomination-proxy: Resource does not exist on FHIR server, making request to nomination service: GET', url);
                    return HTTP.read(url).then(function (value) {
                        // result is a JSON array
                        var nominations = JSON.parse(value);
                        if (nominations.length !== 1) {
                            throw new Error('Made GET request to nomination service, unexpected result! array length = ' + nominations.length);
                        }
                        body = generateResource(nominations[0]);
                        remoteRes.statusCode = 200;
                    }).fail(function (err) {
                        app.logger.error('nomination-proxy: Failed to get nomination for resourceId %s:', resourceId, err);
                        return Q.reject(); // return a rejection so we jump to the finish routine
                    });
                }
                // this FHIR resource does exist, see if there are any 'update' nominations to apply to it
                return parseBody().then(function () {
                    var url = app.config.get('nomination_service') + '/nominations' + authorId + '/resource-id/' + resourceId;
                    app.logger.verbose('nomination-proxy: Making request to nomination service: GET', url);
                    return HTTP.read(url).then(function (value) {
                        // result is a JSON array
                        body.nominations = JSON.parse(value);
                    }).fail(function (err) {
                        app.logger.error('nomination-proxy: Failed to get nominations for %s:', resourceType, err);
                        return Q.reject(); // return a rejection so we jump to the finish routine
                    });
                });
            }).then(applyResponseBody).fail(function (err) {
                // catch rejections so they don't throw "real" errors
            }).fin(generateResponse).done();
        }

        function interceptReadMany() {
            parseBody().then(function () {
                carePlanId = parsed.query['_id'];
                if (parsed.query['_include'] === 'CarePlan:goal') {
                    // this is a request for Goals
                    return injectNominationsForBundle('Goal');
                } else if (parsed.query['_include'] === 'CarePlan:activityreference') {
                    // this is a request for ProcedureRequests and NutritionOrders
                    return injectNominationsForBundle('ProcedureRequest')
                        .thenResolve('NutritionOrder')
                        .then(injectNominationsForBundle);
                    // TODO: remove this when HAPI is updated to support advanced _include queries and CareShare is updated accordingly
                } else if (parsed.query['_include'] === 'CarePlan:activityreference:ProcedureRequest') {
                    // this is a request for ProcedureRequests (Interventions)
                    return injectNominationsForBundle('ProcedureRequest');
                } else if (parsed.query['_include'] === 'CarePlan:activityreference:NutritionOrder') {
                    // this is a request for NutritionOrders (Nutrition)
                    return injectNominationsForBundle('NutritionOrder');
                }
            }).then(applyResponseBody).fail(function (err) {
                // catch rejections so they don't throw "real" errors
            }).fin(generateResponse).done();
        }

        function interceptReadPatient() {
            parseBody().then(function () {
                if (split[2]) {
                    // this is a read for a single patient, e.g.
                    //  * GET http://fhir.vacareshare.org/Patient/123
                    // we don't need nomination data for this, ignore it
                    return;
                }
                var patientIds = [];
                for (var i = 0; i < body.entry.length; i++) {
                    var patient = body.entry[i].resource;
                    if (patient.resourceType === 'Patient') {
                        patientIds.push(patient.id);
                    }
                }
                var url = app.config.get('nomination_service') + '/nominations/' + authorId + '/patient-ids/' + patientIds.join();
                app.logger.verbose('nomination-proxy: Making request to nomination service: GET', url);
                return HTTP.read(url).then(function (value) {
                    var result = JSON.parse(value);
                    // result is a JSON map, key=patientId, value=boolean (whether or not there are nominations for this patient)
                    for (var i = 0; i < body.entry.length; i++) {
                        var patient = body.entry[i].resource;
                        if (patient.resourceType === 'Patient') {
                            patient.hasNominations = (result[patient.id] === true);
                        }
                    }
                });
            }).then(applyResponseBody).fail(function (err) {
                // catch rejections so they don't throw "real" errors
            }).fin(generateResponse).done();
        }

        function parseBody() {
            return Q.fcall(function () {
                // if parsing JSON fails, catch the error and proxy the response through
                body = JSON.parse(remoteResBody.toString('utf8'));
            }).fail(function (err) {
                app.logger.error('nomination-proxy: Failed to parse JSON body of FHIR response:', err);
                return Q.reject(); // return a rejection so we jump to the finish routine
            });
        }

        function injectNominationsForBundle(resType) {
            var url = app.config.get('nomination_service') + '/nominations/care-plan-id/' + carePlanId + authorId
                + '/resource-type/' + dasherize(resType);
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
                for (var i = 0; i < create.length; i++) {
                    body.entry.push({
                        resource: generateResource(create[i])
                    });
                }
            }).fail(function (err) {
                app.logger.error('nomination-proxy: Failed to get nominations for %s:', resType, err);
                return Q.reject(); // return a rejection so we jump to the finish routine
            });
        }

        function applyResponseBody() {
            // if we made it this far without any errors, apply changes to remoteResBody
            remoteResBody = JSON.stringify(body);
            remoteRes.headers['content-length'] = remoteResBody.length;
            // make sure these headers are removed so browsers don't cache content for individual resources
            delete remoteRes.headers['etag'];
            delete remoteRes.headers['last-modified'];
        }

        function generateResource(nomination) {
            // for generating a spoofed resource from a 'create' nomination
            var value  = nomination.proposed;
            value.id = nomination.resourceId;
            nomination.proposed = {};
            value.nominations = [nomination];
            return value;
        }

        function generateResponse() {
            // pass the response back to the client
            performResponse(remoteRes, remoteResBody);
        }

        switch (method) {
            case 'get':
                // requests for Nominate-able resources will look like this:
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Agoal
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference
                //  * GET http://fhir.vacareshare.org/Goal/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/ProcedureRequest/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/NutritionOrder/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/Patient?_count=50&_format=json
                // when HAPI is updated to support advanced _include queries and CareShare is updated accordingly, requests will look like this:
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Agoal
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference:ProcedureRequest
                //  * GET http://fhir.vacareshare.org/CarePlan?_count=50&_format=json&_id=1452522814664-10000003&_include=CarePlan%3Aactivityreference:NutritionOrder
                //  * GET http://fhir.vacareshare.org/Goal/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/ProcedureRequest/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/NutritionOrder/1452522814664-10000003
                //  * GET http://fhir.vacareshare.org/Patient?_count=50&_format=json

                if (resourceType === 'CarePlan' && parsed.query['_id']) {
                    // these are read requests, we must inject results from the Nomination Service
                    interceptReadMany();
                } else if (resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                    // these are read requests, we must inject results from the Nomination Service
                    interceptReadOne();
                } else if (resourceType === 'Patient') {
                    // these are read requests, we must inject results from the Nomination Service
                    interceptReadPatient();
                } else {
                    // the request is NOT for a Nominate-able resource, pass it along
                    generateResponse();
                }
                break;
            default:
                // these are responses to create/update/delete/options requests, pass them along
                performResponse(remoteRes, remoteResBody);
                break;
        }
    });

    // overload
    function resolveAllNominations(resourceId, resolution) {
        var url = app.config.get('nomination_service') + '/nominations/resource-id/' + resourceId;
        deleteNomination(url, resolution);
    }

    function resolveNominations(resolution, nominationIds) {
        var prefix = app.config.get('nomination_service') + '/nominations/id/';

        if (nominationIds && nominationIds.constructor === Array) {
            for (var i = 0; i < nominationIds.length; i++) {
                var url = prefix + nominationIds[i];
                deleteNomination(url, resolution);
            }
        }
    }

    function deleteNomination(url, resolution) {
        app.logger.verbose('nomination-proxy: Making request to nomination service: DELETE %s (nomination %s)', url, resolution);
        // TODO: implement resolution
        HTTP.request({
            url: url,
            method: 'DELETE'
        }).fail(function (err) {
            app.logger.error('nomination-proxy: Failed to make request to nomination service!', err);
        }).done();
    }

    function stringifyReplacer(key, value) {
        // replace unwanted attributes with undefined attributes (so they don't show up in the stringified object)
        if (value === null || value === undefined) {
            // null/undefined attributes
            return undefined;
        } else if (value.constructor === Array && value.length === 0) {
            // empty arrays
            return undefined;
        } else if (key === 'id' || key === 'meta') {
            // ''meta' attribute in existing object, 'id' attributes in existing/proposed objects
            return undefined;
        } else if (key === 'resourceType') {
            var dasherized = dasherize(value);
            if (['goal', 'procedure-request', 'nutrition-order'].indexOf(dasherized) < 0) {
                return undefined;
            }
        } else if (key.length > 0 && typeof value === 'object') {
            // filter out empty objects, but we are traveling from top to bottom... so we have to recurse
            var result = JSON.stringify(value, stringifyReplacer);
            if (result === '{}') {
                return undefined;
            }
        }
        return value;
    }

    function dasherize(value) {
        return value.replace(/[A-Z]/g, function (char, index) {
            return (index !== 0 ? '-' : '') + char.toLowerCase();
        });
    }
};
