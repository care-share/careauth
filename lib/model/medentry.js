'use strict';

// import internal modules
var app = require('../app');

module.exports = MedEntry;

function MedEntry(mongoose) {
    var MedEntry = new mongoose.Schema({
        // _id is automatically added by mongo
        patient_id: {type: String, required: true},
        medication_id: {type: String, required: false},
        medication_order_id: {type: String, required: false},
        created_by: {type: String, required: true},
        name: {type: String, required: false},
        dose: {type: String, required: false},
        freq: {type: String, required: false},
        compliance_bool: {type: Boolean, default: false},
        med_bool: {type: Boolean, default: false},
        note: {type: String, required: false},
        timestamp: {type: Date, required: true},
        // the following attributes are applied by the VA users in the CareShare 'medrec' interface
        action: {type: String, required: false}, // TODO: make this an enum
        hhNotes: {type: String, required: false},
        vaNotes: {type: String, required: false}
    });

    return mongoose.model('MedEntry', MedEntry);
}