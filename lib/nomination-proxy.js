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
var httpProxySimple = require('http-proxy-simple');
var HTTP = require('q-io/http');
var urlParser = require('url');
var Q = require('q');

// import internal modules
var auth = require('./auth');
var dasherize = require('./utils').dasherize;

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
        var isResChanged = false;
        var body;

        function interceptCreateOrUpdate() {
            Q.fcall(function () {
                body = JSON.parse(req.body);
            }).then(function () {
                var carePlanId = body.carePlanId;
                var patientId = body.patientId;
                if (carePlanId === null || carePlanId === undefined) {
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
                    resolveNominations('physician-accepted', accepted);
                    resolveNominations('physician-rejected', rejected);
                } else {
                    var rejected = body.rejectedNominations; // list of nomination IDs we have rejected for this resource
                    if (rejected && rejected.length > 0) {
                        resolveNominations('user-rejected', rejected);
                        return;
                    }
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
                        // apply whitelisted attributes to the target resource
                        // (for example, HH users can modify relationships without submitting a change request)
                        var proposed = body;
                        isResChanged = app.acl.processAttrs(result.existing, proposed);
                        body = result.existing;
                        // return the nomination to be created
                        return {
                            authorId: req.user.id,
                            resourceId: resourceId,
                            carePlanId: carePlanId,
                            patientId: patientId,
                            resourceType: dasherize(resourceType),
                            action: result.action,
                            existing: result.existing,
                            proposed: proposed
                        };
                    }).then(createNomination);
                }
            }).then(function() {
                // remove these attributes so HAPI FHIR doesn't explode...
                scrubNominationAttrs(body);
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
                    resolveAllNominations(resourceId, 'physician-cascade-deleted');
                } else {
                    // create a nomination for this request
                    var revInclude;
                    if (resourceType === 'Condition') {
                        revInclude = 'condition';
                    } else if (resourceType === 'Goal') {
                        revInclude = 'goal';
                    } else if (resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                        revInclude = 'activityreference';
                    }
                    var url = app.config.get('proxy_fhir') + '/' + resourceType + '?_id=' + resourceId + '&_format=json&_revinclude=CarePlan:' + revInclude;
                    app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
                    return HTTP.read(url).then(function (value) {
                        var result = JSON.parse(value);
                        if (result.total === 0) {
                            // the resource does not exist; we can't be sure, but this is probably a request by the HH user to delete a 'create' nomination
                            resolveAllNominations(resourceId, 'user-rejected');
                            return;
                        }
                        // the resource does exist, this should be a request by the HH user to create a 'delete' nomination
                        if (result.total !== 1 && result.total !== 2) {
                            throw new Error('Made GET request to FHIR server, unexpected result! array length = ' + result.entry.length);
                        }
                        var carePlanIsFirst = result.entry[0].resourceType === 'CarePlan';
                        var existing = result.entry[carePlanIsFirst ? 1 : 0].resource;
                        var carePlanId = '';
                        var patientId = '';
                        if (result.total === 2) {
                            var carePlan = result.entry[carePlanIsFirst ? 0 : 1].resource;
                            carePlanId = carePlan.id;
                            patientId = carePlan.subject.reference.split('/')[1];
                        } else if (resourceType === 'Condition') {
                            // attempt to get patientId from Condition
                            patientId = existing.patient.reference.split('/')[1];
                        }
                        var nomination = {
                            authorId: req.user.id,
                            resourceId: resourceId,
                            carePlanId: carePlanId,
                            patientId: patientId,
                            resourceType: dasherize(resourceType),
                            action: 'delete',
                            existing: existing,
                            proposed: {}
                        };
                        return createNomination(nomination);
                    });
                }
            }).fail(function (err) {
                // catch rejections so they don't throw "real" errors
                app.logger.error('nomination-proxy: Failed to intercept DELETE request:', err);
            }).fin(generateResponse).done();
        }

        function createNomination(nomination) {
            // some attributes are passed up from the PUT request from CareShare to inform us what attribute to add to the
            // nomination; however, those attributes should not be part of the proposed object
            scrubNominationAttrs(nomination.proposed);

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
                    if (!isResChanged) {
                        var string = '{"resourceType":"OperationOutcome"}';
                        res.writeHead(isNewResource ? 201 : 200, {
                            'Content-Length': string.length,
                            'Content-Type': 'application/json'
                        });
                        res.end(string);
                    } else {
                        // the user may change certain whitelisted attributes, continue the request
                        performRequest(remoteReq);
                    }
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

                    if (resourceType === 'Condition' || resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
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
                    if (resourceType === 'Condition' || resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                        // remove headers that may cause the FHIR server to respond with a code 304
                        delete remoteReq.headers['if-modified-since'];
                        delete remoteReq.headers['if-none-match'];
                    }
                    // fall through to default
                default:
                    // these are read/options requests, pass them along
                    performRequest(remoteReq);
                    break;
            }
        });

        function resolveAllNominations(resourceId, resolution) {
            var authorId = req.user.isPhysician ? '' : '/author-id/' + req.user.id;
            var url = app.config.get('nomination_service') + '/nominations' + authorId + '/resource-id/' + resourceId;
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

        function scrubNominationAttrs(obj) {
            delete obj.carePlanId;
            delete obj.patientId;
            delete obj.nominations;
            delete obj.acceptedNominations;
            delete obj.rejectedNominations;
            delete obj.isExpanded;
        }
    });

    proxy.on('http-intercept-response', function (cid, req, res, remoteRes, remoteResBody, performResponse) {
        //app.logger.debug('nomination-proxy: ' + cid + ': HTTP intercept response');
        var parsed = urlParser.parse(req.url, true);
        var split = parsed.pathname.split('baseDstu2')[1].split('/');
        var method = req.method.toLowerCase();
        var carePlanId;
        var patientId;
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
                        if (nominations.length === 0) {
                            // no nominations exist for this resource
                            // it's probably a nomination that was deleted by a HH user (careshare reloads resources after deletion)
                            // do nothing
                            body = '';
                            return;
                        }
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
                        body = applyNominations(req.user.isPhysician, body);
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
                if (resourceType !== 'CarePlan') {
                    patientId = parsed.query['patient']
                    return injectNominationsForBundle(resourceType);
                }

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
                        var resource = body.entry[i].resource;
                        if (resource.resourceType === 'Patient' || resource.resourceType === 'CarePlan') {
                            resource.hasNominations = (result[resource.id] === true);
                        }
                    }
                });
            }).then(applyResponseBody).fail(function (err) {
                // catch rejections so they don't throw "real" errors
            }).fin(generateResponse).done();
        }

        function interceptDelete() {
            // note, we're assuming that the physician sent a DELETE for a nomination... we have no real way of knowing
            // either way, setting the response to 204 doesn't hurt anything
            Q.fcall(function () {
                if (remoteRes.statusCode === 404) {
                    remoteRes.statusCode = 204;
                }
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
            var selector = '';
            if (carePlanId) {
                selector = '/care-plan-id/' + carePlanId;
            } else if (patientId) {
                selector = '/patient-id/' + patientId;
            }
            var url = app.config.get('nomination_service') + '/nominations' + selector + authorId
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
                    body.entry[i].resource = applyNominations(req.user.isPhysician, resource);
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
                } else if (resourceType === 'Condition' || resourceType === 'Goal' || resourceType === 'ProcedureRequest' || resourceType === 'NutritionOrder') {
                    // these are read requests, we must inject results from the Nomination Service
                    if (split[2]) {
                        interceptReadOne();
                    } else {
                        interceptReadMany();
                    }
                } else if (resourceType === 'Patient') {
                    // these are read requests, we must inject results from the Nomination Service
                    interceptReadPatient();
                } else {
                    // the request is NOT for a Nominate-able resource, pass it along
                    generateResponse();
                }
                break;
            case 'delete':
                // if a physician has deleted a resource, do nothing
                // if a physician has deleted a nomination (status code 404), change status code to 204
                // if a HH user has sent a DELETE, it will never make it to this response processor
                interceptDelete();
                break;
            default:
                // these are responses to create/update/delete/options requests, pass them along
                performResponse(remoteRes, remoteResBody);
                break;
        }
    });

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

    function applyNominations(isPhysician, resource) {
        if (isPhysician) {
            return resource;
        }
        var noms = resource.nominations;
        // all nominations for a single non-physician user will have the same 'proposed' object
        if (noms && noms.length > 0) {
            if (!noms[0].proposed) {
                // this is a 'delete' change request
                return resource;
            }
            var proposed = JSON.parse(JSON.stringify(noms[0].proposed)); // poor man's clone function
            proposed.id = resource.id;
            proposed.nominations = noms;
            return proposed;
        }
        return resource;
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
            if (['condition', 'goal', 'procedure-request', 'nutrition-order'].indexOf(dasherized) < 0) {
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
};
