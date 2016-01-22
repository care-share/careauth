'use strict';

// import internal modules
var app = require('../app');

module.exports = MedRec;

function MedRec(mongoose) {
    var MedRec = new mongoose.Schema({
        // _id is automatically added by mongo
        patient_id: {type: String, required: true, index: {unique: true}},
        created_by: {type: String, required: true},
        name_sub: {type: String, required: false},
        dose: {type: String, required: false},
        freq: {type: String, required: false},
        compliance_bool: {type: boolean, required: false},
        med_bool: {type: boolean, required: false},
        note: {type: String, required: false},
        timestamp: {type: Date, default: Date.now}
    });

    return mongoose.model('MedRec', MedRec);
}
