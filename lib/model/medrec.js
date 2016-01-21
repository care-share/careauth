'use strict';

// import internal modules
var app = require('../app');

module.exports = MedRec;

function MedRec(mongoose) {
    var MedRec = new mongoose.Schema({
        // _id is automatically added by mongo
        patient_id: {type: String, required: true, index: {unique: true}},
        created_by: {type: String, required: true},
        foo: {type: String, required: true},
        bar: {type: String, required: true},
        timestamp: {type: Date, default: Date.now}
    });

    return mongoose.model('MedRec', MedRec);
}
