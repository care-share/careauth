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
var Q = require('q');
var HTTP = require('q-io/http');

// import internal modules
var app = require('../../lib/app');
var MedEntry = app.MedEntry;
var Comm = app.Comm;
var respond = require('../../lib/utils').respond;
var dasherize = require('../../lib/utils').dasherize;
var newUuid = require('../../lib/utils').newUuid;
var FhirCloner = require('../../lib/fhir_cloner');

// API: POST /clone/patient_id/:patient_id
// returns: {newPatientId}
exports.clonePatient = function (req, res) {
    var patientId = req.params.patient_id;
    var args = {patientId: patientId};

    cloneFhirData(args)
        .then(cloneMedEntryData)
        .then(cloneCommData)
        .then(cloneNominationData)
        .then(function (result) {
            // all the cloning was successful, let's return the new patient ID
            var patientId = result.patientId;
            var newPatientId = result.idMap[patientId];
            app.logger.debug('clone controller: Successfully cloned patient "%s", new ID "%s"', patientId, newPatientId);
            respond(res, 200, {newPatientId: newPatientId});
        }).catch(function (err) {
        // if we fail at any step in the above portions, we return an error message
        // TODO: determine where we failed and remove newly-created records that are incomplete
        app.logger.error('clone controller: Failed to clone patient "%s":', patientId, err);
        respond(res, 500);
    }).done();
};

// clones FHIR data, returns a map specifying old resource IDs and their new counterparts
// params: {patientId}
function cloneFhirData(params) {
    var patientId = params.patientId;
    var fhirBaseUrl = app.config.get('proxy_fhir');

    var fhirCloner = new FhirCloner(fhirBaseUrl);
    return fhirCloner.clonePatientMain(patientId).then(function (idMap) {
        return {
            patientId: patientId,
            idMap: idMap
        };
    });
}

// params: {patientId, idMap}
function cloneMedEntryData(params) {
    return cloneMongoDocs('MedEntry', params, ['medication_id', 'medication_order_id']);
}

// params: {patientId, idMap}
function cloneCommData(params) {
    return cloneMongoDocs('Comm', params, ['careplan_id', 'resource_id']);
}

// params: {patientId, idMap}
function cloneNominationData(params) {
    var patientId = params.patientId;
    var idMap = params.idMap;
    var url = app.config.get('nomination_service') + '/change-requests/patient-id/' + patientId;

    // recursive method to sequentially PUT new nominations
    function putNominations(nominations) {
        if (nominations.length === 0) {
            return Q.resolve();
        }
        var nomination = nominations.pop();
        var url = app.config.get('nomination_service') + '/nominations';
        app.logger.verbose('clone controller: Making request to nomination service: PUT %s (authorId: %s, resourceId: %s, carePlanId: %s, patientId: %s)',
            url, nomination.authorId, nomination.resourceId, nomination.carePlanId, nomination.patientId);
        var bodyString = JSON.stringify(nomination); // we shouldn't have to replace any invalid attributes for this
        return HTTP.request({
            url: url,
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: [bodyString]
        }, function (err) {
            // ran into a problem cloning this particular Nomination; skip it and continue
            app.logger.error('clone controller: Unable to PUT nomination:', err.message);
        }).then(function () {
            // recurse
            return putNominations(nominations);
        });
    }

    return HTTP.read(url).then(function (value) {
        var result = JSON.parse(value);
        // loop through the nomination result and transform them into new nominations by mapping old IDs to new ones
        var list = [];
        for (var i = 0; i < result.length; i++) {
            // create the skeleton for transformed nominations
            var changeReq = result[i];
            var baseNomination = {
                patientId: idMap[patientId],
                carePlanId: idMap[changeReq.carePlanId],
                authorId: changeReq.authorId,
                timestamp: changeReq.timestamp
            };
            // populate the list of transformed nominations
            var populateNominations = function (attr) {
                var array = changeReq[attr];
                for (var j = 0; j < array.length; j++) {
                    var entry = array[j];
                    var resourceId = idMap[entry.resourceId];
                    if (entry.action === 'create') {
                        // this resourceId does not exist in FHIR yet, therefore it won't be present in our idMap
                        // we must generate a brand new UUID for this nomination
                        resourceId = newUuid(entry.resourceId);
                    }
                    if (resourceId) {
                        var nomination = cloneObj(baseNomination);
                        nomination.resourceId = resourceId;
                        nomination.resourceType = dasherize(attr).slice(0, -1);
                        nomination.action = entry.action;
                        nomination.existing = entry.existing;
                        nomination.proposed = entry.proposed;
                        // we don't have to loop through existing/proposed and change object relation attributes, because
                        // object relation attributes are automatically approved (not stored as nominations)
                        list.push(nomination);
                    } else {
                        // ran into a problem cloning this particular Nomination; skip it and continue
                        app.logger.error('clone controller: Unable to clone nomination for: patientId "%s", carePlanId "%s", authorId "%s", resourceId "%s" (no mapped resource ID)',
                            patientId, changeReq.carePlanId, changeReq.authorId, entry.resourceId);
                    }
                }
            };
            populateNominations('conditions');
            populateNominations('goals');
            populateNominations('procedureRequests');
            populateNominations('nutritionOrders');
        }
        // PUT the transformed nominations
        return putNominations(list);
    }, function (err) {
        // bubble this error message/stacktrace up to the top-level error handler
        throw new Error('Unable to read data from nomination service: ' + err.message);
    }).thenResolve(params);
}

function cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function cloneMongoDocs(model, params, attrs) {
    var patientId = params.patientId;
    var idMap = params.idMap;

    // recursive method to sequentially save new medentry documents
    function saveDocuments(documents) {
        if (documents.length === 0) {
            return;
        }
        var document = documents.pop();
        var attrMap = {}; // map of attributes that should be transformed with the idMap
        var idNotFound = false;
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            var entry = document[attr];
            attrMap[attr] = entry;
            if (!entry) { // should not be undefined, null, or blank
                idNotFound = true;
                break;
            }
        }

        if (!idNotFound) {
            document._id = app.mongoose.Types.ObjectId();
            document.isNew = true;
            document.patient_id = idMap[patientId];
            for (var i = 0; i < attrs.length; i++) {
                var attr = attrs[i];
                document[attr] = idMap[document[attr]];
            }
            return document.saveQ()
                .catch(function (err) {
                    // ran into a problem cloning this particular document; skip it and continue
                    app.logger.error('clone controller: Unable to clone %s "%s" for patientId "%s":',
                        model, document._id, patientId, err.message);
                }).thenResolve(documents)
                .then(saveDocuments);
        } else {
            // ran into a problem cloning this particular document; skip it and continue
            app.logger.error('clone controller: Unable to clone %s "%s" for patientId "%s" (mapped attribute ID missing)',
                model, document._id, patientId);
            return saveDocuments(documents);
        }
    }

    return app[model].findQ({patient_id: patientId})
        .then(saveDocuments)
        .thenResolve(params);
}
