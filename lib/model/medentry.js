'use strict';

// import internal modules
var app = require('../app');

module.exports = MedEntry;

function MedEntry(mongoose) {
    var MedEntry = new mongoose.Schema({
        //TODO change compliance_bool and med_bool to ENUM string {0,1}
        // _id is automatically added by mongo
        patient_id: {type: String, required: true},
        medication_id: {type: String, required: false},
        medication_order_id: {type: String, required: false},
        created_by: {type: String, required: true},
        name: {type: String, required: false},
        dose: {type: String, required: false},
        freq: {type: String, required: false},
        compliance_bool: {type: String, required: false},
        med_bool: {type: String, required: false},
        note: {type: String, required: false},
        timestamp: {type: Date, default: Date.now}
    });

    return mongoose.model('MedEntry', MedEntry);
}