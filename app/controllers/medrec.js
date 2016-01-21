'use strict';

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
    var _id = req.body._id;
    var patient_id = req.body.patient_id;
    var created_by = req.body.created_by;
    var foo = req.body.foo;
    var bar = req.body.bar;
    var timestamp = new Date();
    if (!_id || !patient_id || !created_by || !foo || !bar) {
        respond(res, 400);
        return;
    }

    var model = new MedRec({
        _id: _id,
        patient_id: patient_id,
        created_by: created_by,
        foo: foo,
        bar: bar,
        timestamp: timestamp
    });
    model.saveQ(function () {
        respond(res, 200);
    }).catch(function (err) {
        app.logger.error('Failed to save MedRec "%s":', _id, err);
        respond(res, 500);
    }).done();
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
