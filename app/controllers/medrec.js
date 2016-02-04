'use strict';

// import external modules
var HTTP = require('q-io/http');

// import internal modules
var app = require('../../lib/app');
var MedEntry = app.MedEntry;
var respond = require('../../lib/utils').respond;

// API: GET /medrecs/patient_id/:patient_id
exports.findMedRecs = function (req, res) {
    // get MedEntry models from Mongo
    var query = {patient_id: req.params.patient_id};
    MedEntry.find(query).lean().execQ().then(function (medEntries) {
        // get MedicationOrder/Medication models from FHIR
        var url = app.config.get('proxy_fhir') + '/MedicationOrder?_include=MedicationOrder:medication&_format=json&_count=50&patient=' + query.patient_id;
        app.logger.verbose('nomination-proxy: Making request to FHIR server: GET', url);
        return HTTP.read(url).then(function (value) {
            var fhirData = JSON.parse(value);
            // TODO: get MedRec data from the TranScript API
            //  NOTE: the input for TranScript API should have the medication name in MedicationOrder.medicationReference.display
            //  however, we can't be sure our FHIR data is formed like that
            //  so you need to do an intermediary step, first loop through all Medications and get the Medication.code.text; make a map like so:
            //    {
            //        medicationId: medicationText,
            //        ...
            //    }
            //  then, loop through all MedicationOrders, for each one: parse the MedicationOrder.medicationReference.reference to get the Medication ID it refers to
            //  finally, use the Medication ID to get the Medication Text from the map, and use that to set the MedicationOrder.medicationReference.display
            var modifiedMedOrders = [];
            url = 'hardcoded transcript API URL'; // TODO: eventually store this in config
            var body = {
                patientId: query.patient_id,
                hh: medEntries,
                va: modifiedMedOrders
            };
            return HTTP.request({
                url: url,
                method: 'POST', // not sure what method, I assume it will be POST
                headers: {'Content-Type': 'application/json'},
                body: [JSON.stringify(body)]
            }).then(function (medRecs) {
                // TODO: after that, loop MedRec data response, and transform the array data into wrappers like so:
                //{
                //    MedEntry: {},
                //    Medication: {},
                //    MedicationOrder: {},
                //    MedRec: {}
                //}
                // TODO: after that, return the array of all wrapped elements
                var wrappedData = [];
                respond(res, 200, wrappedData);
            }, function (err) {
                throw new Error('Error when contacting TranScript server: ' + err.message);
            });
        }, function (err) {
            throw new Error('Error when contacting FHIR server: ' + err.message);
        });
    }).catch(function (err) {
        app.logger.error('Failed to find MedRecs for Patient "%s":', query.patient_id, err);
        respond(res, 500);
    }).done();
};

exports.findMedEntries = function (req, res) {
    var query = {patient_id: req.params.patient_id};
    MedEntry.find(query).lean().execQ().then(function (result) {
        respond(res, 200, result);
    }).catch(function (err) {
        app.logger.error('Failed to find MedEntries for Patient "%s":', query.patient_id, err);
        respond(res, 500);
    }).done();
};

// req.body should contain an array of MedEntry attributes
exports.saveMedEntries = function (req, res) {
    var saveModels = [];
    var args = undefined;
    var firstField = 'med_name';
    var timestamp = new Date(); // so all models are saved at the exact same time

    function createModel() {
        if (args !== undefined) {
            // create a new MedEntry model
            args.timestamp = timestamp;
            var model = new MedEntry(args);
            // add a promise to save that model to the models array
            //saveModels.push(model.saveQ);
            // FIXME: save an array of promises, that isnt working so we are adding a model to the array instead of a promise
            saveModels.push(model);
        }
        // after, reset the args to a new object
        args = {
            patient_id: req.body.patient_id,
            created_by: req.user.id
        };
    }

    for (var i = 0; i < req.body.formData.length; i++) {
        var field = req.body.formData[i];
        if (field.name === firstField) {
            // this is the beginning of a new set of form fields, create a new model if we can
            createModel();
        }
        if (field.value !== undefined && field.value !== null && field.value !== '') {
            args[field.name] = field.value;
        }
    }
    // now that the loop is over, call createModel again (needed because we end on the last form field!)
    createModel();

    //// now we have a models array that is populated...
    //Q.allSettled(saveModels).then(function () {
    //    respond(res, 200);
    //}).catch(function (err) {
    //    app.logger.error('Failed to save MedEntry(s):', err);
    //    respond(res, 500);
    //}).done();
    // FIXME: save an array of promises, that isnt working so we are saving like this at the moment
    for (var i = 0; i < saveModels.length; i++) {
        saveModels[i].saveQ().catch(function (err) {
            app.logger.error('Failed to save MedEntry:', err);
        }).done();
    }
    respond(res, 200);
};

exports.deleteMedEntry = function (req, res) {
    var query = {_id: req.params.id};
    MedEntry.findOneAndRemoveQ({_id: req.params.id}).then(function (result) {
        if (result) {
            respond(res, 200);
        } else {
            respond(res, 404);
        }
    }).catch(function (err) {
        app.logger.error('Failed to delete MedEntry "%s":', query._id, err);
        respond(res, 500);
    }).done();
};
