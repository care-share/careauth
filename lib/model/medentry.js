/*
 * Copyright 2016 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// import internal modules
var app = require('../app');

module.exports = MedEntry;

function MedEntry(mongoose) {
    var MedEntry = new mongoose.Schema({
        // _id is automatically added by mongo
        patient_id: {type: String, required: true},
        medication_id: {type: String, default: ''},
        medication_order_id: {type: String, default: ''},
        created_by: {type: String, required: true},
        name: {type: String, default: ''},
        dose: {type: String, default: ''},
        freq: {type: String, default: ''},
        compliance_bool: {type: Boolean},
        noncompliance_note: {type: String, default: ''},
        med_bool: {type: Boolean},
        prescriber_note: {type: String, default: ''},
        note: {type: String, default: ''},
        not_found: {type: Boolean},
        timestamp: {type: Date, required: true},
        // the following attributes are applied by the VA users in the CareShare 'medrec' interface
        action: {type: String}, // TODO: make this an enum
        hhNotes: {type: String},
        vaNotes: {type: String}
    });

    return mongoose.model('MedEntry', MedEntry);
}
