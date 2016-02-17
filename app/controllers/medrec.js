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
            // NOTE: the input for TranScript API should have the medication name in MedicationOrder.medicationReference.display
            // however, we can't be sure our FHIR data is formed like that
            // so, we loop through all MedicationOrders and the Medications they refer to, setting the attribute manually
            var medNameMap = {};
            var medOrders = [];
            for (var i = 0; i < fhirData.entry.length; i++) {
                var resource = fhirData.entry[i].resource;
                if (resource.resourceType === 'Medication') {
                    if (resource.id && resource.code && resource.code.text) {
                        medNameMap[resource.id] = resource.code.text;
                    }
                } else if (resource.resourceType === 'MedicationOrder') {
                    delete resource.meta; // delete unneeded metadata attribute
                    medOrders.push(resource);
                }
            }
            for (var j = 0; j < medOrders.length; j++) {
                var medOrder = medOrders[j];
                if (medOrder.medicationReference && medOrder.medicationReference.reference) {
                    var medId = medOrder.medicationReference.reference.split('/')[1];
                    medOrder.medicationReference.display = medNameMap[medId];
                }
            }

            // THIS IS STUB CODE
            // TODO: remove this response once we contact the TranScript API!
            var medOrderIdMap = {};
            for (var k = 0; k < medOrders.length; k++) {
                var medOrder = medOrders[k];
                medOrderIdMap[medOrder.id] = medOrder;
            }
            var temp = [];
            for (var l = 0; l < medEntries.length; l++) {
                var medEntry = medEntries[l];
                var medOrder = medOrderIdMap[medEntry.medication_order_id];
                temp.push({
                    homeMed: medEntry,
                    ehrMed: medOrder,
                    status: 'active',
                    discrepancy: {
                        name: true,
                        dose: false
                    }
                });
            }
            respond(res, 200, temp);

            // TODO: get MedRec data from the TranScript API
            //url = 'hardcoded transcript API URL'; // TODO: eventually store this in config
            //var body = {
            //    patientId: req.params.patient_id,
            //    hh: medEntries,
            //    va: medOrders
            //};
            //return HTTP.request({
            //    url: url,
            //    method: 'POST', // not sure what method, I assume it will be POST
            //    headers: {'Content-Type': 'application/json'},
            //    body: [JSON.stringify(body)]
            //}).then(function (medRecs) {
                // TODO: after that, loop MedRec data response, and transform the array data into wrappers like so:
                //{
                //    homeMed: {},
                //    ehrMed: {},
                //    status: 'foo',
                //    discrepancy: {}
                //}
                // TODO: after that, return the array of all wrapped elements
                //var wrappedData = [];
                //respond(res, 200, wrappedData);
            //}, function (err) {
            //    throw new Error('Error when contacting TranScript server: ' + err.message);
            //});
        }, function (err) {
            throw new Error('Error when contacting FHIR server: ' + err.message);
        });
    }).catch(function (err) {
        app.logger.error('Failed to find MedRecs for Patient "%s":', req.params.patient_id, err);
        respond(res, 500);
    }).done();
};

exports.findMedEntries = function (req, res) {
    // use query below to find the timestamp of the most recent MedEntry for patient_id X, created_by Y, and action != '':
    //      var query = {patient_id: req.params.patient_id, created_by: req.user.id, action: {$exists: true}};
    var query = {patient_id: req.params.patient_id, created_by: req.user.id};
    var sortquery = {timestamp: -1};
    // db.medentries.find({patient_id: "1452917292723-444-44-4444", created_by: "56956a31c823716f0ba7881c"}).sort({timestamp: -1})

    MedEntry.find(query).sort(sortquery).lean().execQ().then(function (result) {
        // Now we have MedEntry sorted by most recent 'timestamp' for patient_id X, created_by Y
        // loop through to get the lastest MedEntry
        var data = [];
        var recentTime = result[0].timestamp.getTime();
        for(var i=0; i < result.length; i++){
            if(result[i].timestamp.getTime() == recentTime){
                console.log('recent time:' + recentTime + JSON.stringify(result[i]));
                data.push(result[i]);
            }else{
                console.log('recent time does not match' + result[i].timestamp);
            }
        }

        respond(res, 200, data);
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

            // reconcile medication name (or substituted name) that is submitted by user
            if(args.name_sub && args.name_sub.length > 0){
                args.name = args.name_sub;
            } else {
                args.name = args.med_name;
            }
            delete args.med_name;
            delete args.name_sub;

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
