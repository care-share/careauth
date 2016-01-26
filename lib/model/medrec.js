'use strict';

// import internal modules
var app = require('../app');

module.exports = MedRec;

function MedRec(mongoose) {
    var MedRec = new mongoose.Schema({
        //TODO change compliance_bool and med_bool to ENUM string {0,1}
        // _id is automatically added by mongo
        patient_id: {type: String, required: true},
        created_by: {type: String, required: true},
        med_name: {type: String, required: false},
        name_sub: {type: String, required: false},
        dose: {type: String, required: false},
        freq: {type: String, required: false},
        compliance_bool: {type: String, required: false},
        med_bool: {type: String, required: false},
        note: {type: String, required: false},
        timestamp: {type: Date, default: Date.now}
    });

    return mongoose.model('MedRec', MedRec);
}