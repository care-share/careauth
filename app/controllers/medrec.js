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
    var update = {};
    for (var i in req.body){
        var key = req.body[i].name;
        var value = req.body[i].value;
        if (key ===  '_id' || key === 'patient_id' || key === 'created_by' || key === 'med_name' || key === 'name_sub' || key === 'dose' || key === 'freq'
            || key === 'compliance_bool' || key === 'med_bool' || key === 'note' || key === 'timestamp') {
            update[key] = value;
        }
    }

    var model = new MedRec({
        _id: update['_id'],
        patient_id: update['patient_id'],
        created_by: update['created_by'],
        med_name: update['med_name'],
        name_sub: update['name_sub'],
        dose: update['dose'],
        freq: update['freq'],
        compliance_bool: update['compliance_bool'],
        med_bool: update['med_bool'],
        note: update['note'],
        timestamp: update['timestamp']
    });
    model.saveQ(function () {
        respond(res, 200);
    }).catch(function (err) {
        app.logger.error('Failed to save MedRec "%s":', update['_id'], err);
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
