'use strict';

// import external modules
var Q = require('q');
var HTTP = require('q-io/http');

// import internal modules
var app = require('../../lib/app');
var respond = require('../../lib/utils').respond;
var dasherize = require('../../lib/utils').dasherize;

// API: POST /clone/patient_id/:patient_id
// returns: {newPatientId}
exports.clonePatient = function (req, res) {
    var patientId = req.params.patient_id;
    var args = {patientId: patientId};

    cloneFhirData(args)
        .then(cloneMedEntryData)
        .then(cloneAnnotationData)
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

    // TODO: remove this stub code
    params.idMap = {};
    params.idMap[patientId] = new Date().getTime() + '-' + patientId;
    return Q.resolve(params);
}

// params: {patientId, idMap}
function cloneMedEntryData(params) {
    // TODO: remove this stub code
    return Q.resolve(params);
}

// params: {patientId, idMap}
function cloneAnnotationData(params) {
    // TODO: remove this stub code
    return Q.resolve(params);
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
            app.logger.error('clone controller: Failed to PUT nomination:', err.message);
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
            var populateNominations = function(attr) {
                var array = changeReq[attr];
                for (var j = 0; j < array.length; j++) {
                    var entry = array[j];
                    var resourceId = idMap[entry.resourceId];
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
                        app.logger.error('clone controller: Failed to clone nomination for: patientId "%s", carePlanId "%s", authorId "%s", resourceId "%s" (no mapped resource ID)',
                            patientId, changeReq.carePlanId, changeReq.authorId, entry.resourceId)
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
