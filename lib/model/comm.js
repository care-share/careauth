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

module.exports = Comm;

function Comm(mongoose) {
    var Comm = new mongoose.Schema({
        // _id is automatically added by mongo

        // FHIR resources associated with this Communication
        // 'resource' is a CarePlan component... could be a Goal, Condition, etc.
        resource_id: {type: String},
        resource_type: {type: String},
        careplan_id: {type: String},
        patient_id: {type: String},

        // Communication is initiated by one user
        src_user_id: {type: String},
        // TODO: make a better way to separately communicate user info to CareShare, so we can de-duplicate data here
        src_user_name_first: {type: String},
        src_user_name_last: {type: String},

        // Communication is sent to multiple users; we keep track of who has seen it
        // search embedded documents with the following query: {'dest_users.id': 'foo'}
        dest: [{user_id: {type: String}, seen: {type: Boolean}}],

        // Communication has text content
        content: {type: String, required: true},

        // Communication is sent at a specific date/time
        timestamp: {type: Date, default: Date.now}
    });

    return mongoose.model('Comm', Comm);
}
