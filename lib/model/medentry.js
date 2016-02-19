'use strict';

// import internal modules
var app = require('../app');

module.exports = MedEntry;

function MedEntry(mongoose) {
    var MedEntry = new mongoose.Schema({
        // _id is automatically added by mongo
        patient_id: {type: String, required: true},
        medication_id: {type: String},
        medication_order_id: {type: String},
        created_by: {type: String, required: true},
        name: {type: String},
        dose: {type: String},
        freq: {type: String},
        compliance_bool: {type: Boolean},
        med_bool: {type: Boolean},
        note: {type: String},
        not_found: {type: String},
        timestamp: {type: Date, required: true},
        // the following attributes are applied by the VA users in the CareShare 'medrec' interface
        action: {type: String}, // TODO: make this an enum
        hhNotes: {type: String},
        vaNotes: {type: String}
    });

    return mongoose.model('MedEntry', MedEntry);
}