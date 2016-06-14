'use strict';

// import external modules
var Q = require('q');
var HTTP = require('q-io/http');

// import internal modules
var app = require('../../lib/app');
var respond = require('../../lib/utils').respond;

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
            app.logger.debug('Successfully cloned patient "%s", new ID "%s"', patientId, newPatientId);
            respond(res, 200, {newPatientId: newPatientId});
        }).catch(function (err) {
            app.logger.error('Failed to clone patient "%s":', patientId, err);
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
    // TODO: remove this stub code
    return Q.resolve(params);
}
