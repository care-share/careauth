'use strict';

// import external modules
var Q  = require('q');

// import internal modules
var app = require('../../lib/app');
var MedRec = app.MedRec;
var respond = require('../../lib/utils').respond;

exports.findMedRecs = function (req, res) {
    var query = {patient_id: req.params.patient_id};
    MedRec.find(query).lean().execQ().then(function (result) {
        respond(res, 200, result);
    }).catch(function (err) {
        app.logger.error('Failed to find MedRecs for Patient "%s":', query.patient_id, err);
        respond(res, 500);
    }).done();
};

exports.saveMedRec = function (req, res) {
    var saveModels = [];
    var args = undefined;
    var firstField = 'med_name';

    function createModel() {
        if (args !== undefined) {
            // create a new medrec model
            var model = new MedRec(args);
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
        args[field.name] = field.value;
    }
    // now that the loop is over, call createModel again (needed because we end on the last form field!)
    createModel();

    //// now we have a models array that is populated...
    //Q.allSettled(saveModels).then(function () {
    //    respond(res, 200);
    //}).catch(function (err) {
    //    app.logger.error('Failed to save MedRec(s):', err);
    //    respond(res, 500);
    //}).done();
    // FIXME: save an array of promises, that isnt working so we are saving like this at the moment
    for (var i = 0; i < saveModels.length; i++) {
        saveModels[i].saveQ().catch(function (err) {
            app.logger.error('Failed to save MedRec:', err);
        }).done();
    }
    respond(res, 200);
};

exports.deleteMedRec = function (req, res) {
    var query = {_id: req.params.id};
    MedRec.findOneAndRemoveQ({_id: req.params.id}).then(function (result) {
        if (result) {
            respond(res, 200);
        } else {
            respond(res, 404);
        }
    }).catch(function (err) {
        app.logger.error('Failed to delete MedRec "%s":', query._id, err);
        respond(res, 500);
    }).done();
};
