'use strict';

// import external modules
var Q = require('q');
var HTTP = require('q-io/http');

// import internal modules
var app = require('../../lib/app');
var MedEntry = app.MedEntry;
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
    var patientId = params.patientId;
    var idMap = params.idMap;

    // recursive method to sequentially save new medentry documents
    function saveMedEntries(medEntries) {
        if (medEntries.length === 0) {
            return Q.resolve();
        }
        var medEntry = medEntries.pop();
        var medId = medEntry.medication_id;
        var orderId = medEntry.medication_order_id;
        var idNotFound;
        if (medId.length > 0 || orderId > 0) {
            // medId and orderId should both only be non-empty at the same time, but we check both to be safe
            medId = idMap[medId];
            orderId = idMap[orderId];
            idNotFound = !medId || !orderId;
        }

        if (!idNotFound) {
            medEntry._id = app.mongoose.Types.ObjectId();
            medEntry.isNew = true;
            medEntry.patient_id = idMap[patientId];
            medEntry.medication_id = medId;
            medEntry.medication_order_id = orderId;
            return medEntry.saveQ()
                .catch(function (err) {
                    // ran into a problem cloning this particular MedEntry; skip it and continue
                    app.logger.error('clone controller: Unable to clone MedEntry "%s" for: patientId "%s", medicationId "%s", medicationOrderId "%s":',
                        medEntry._id, patientId, medEntry.medication_id, medEntry.medication_order_id, err.message);
                }).thenResolve(medEntries)
                .then(saveMedEntries);
        } else {
            // ran into a problem cloning this particular MedEntry; skip it and continue
            app.logger.error('clone controller: Unable to clone MedEntry "%s" for: patientId "%s", medicationId "%s", medicationOrderId "%s" (no mapped medication ID or medication order ID)',
                medEntry._id, patientId, medEntry.medication_id, medEntry.medication_order_id);
            return saveMedEntries(medEntries);
        }
    }

    return MedEntry.findQ({patient_id: patientId})
        .then(saveMedEntries)
        .thenResolve(params);
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
