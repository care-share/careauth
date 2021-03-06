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
var app = require('../../lib/app');
var Account = app.Account;
var Comm = app.Comm;
var respond = require('../../lib/utils').respond;

// API: GET /comm ? careplan_id|patient_id|resource_id [& limit]
exports.getComms = function (req, res) {
    var query = {};
    // query must specify a careplan_id, patient_id, or resource_id
    if (!addToQuery(req, query, 'careplan_id')
        && !addToQuery(req, query, 'patient_id')
        && !addToQuery(req, query, 'resource_id')) {
        respond(res, 400); // bad request
        return;
    }

    var limit = 1000;
    if (req.query.limit) {
        limit = req.query.limit;
    }

    // get Comm models from Mongo
    var select = '-__v -dest._id'; // exclude unnecessary fields
    Comm.find(query, select).sort('timestamp').limit(limit).lean().execQ().then(function (comms) {
        respond(res, 200, comms);
    }).catch(function (err) {
        app.logger.error('Failed to find Comms for query "%s":', JSON.stringify(query), err);
        respond(res, 500);
    }).done();
};

function addToQuery(req, query, attr) {
    var param = req.query[attr];
    if (param) {
        if (param.constructor === Array) {
            query[attr] = { '$in': param };
        } else {
            query[attr] = param;
        }
        return true;
    }
    return false;
}

// API: POST /comm
exports.createComm = function (req, res) {
    if (!req.body || !req.body.comm) {
        respond(res, 400);
        return;
    }

    var args = req.body.comm;
    // don't allow _id or timestamp to be set
    delete args._id;
    delete args.timestamp;

    // the src user has already seen this comm
    var found = false;
    if (args.dest) {
        for (var i = 0; i < args.dest.length; i++) {
            if (args.dest[i].user_id === req.user.id) {
                found = true;
                break;
            }
        }
    } else {
        args.dest = [];
    }
    if (!found) {
        args.dest.push({user_id: req.user.id, seen: true});
    }

    Account.findOneQ({_id: req.user.id}).then(function (user) {
        if (!user) {
            respond(res, 404);
            return;
        }
        // set the src user info
        args.src_user_id = req.user.id;
        args.src_user_name_first = user.name_first;
        args.src_user_name_last = user.name_last;
        // save the model
        var model = new Comm(args);
        return model.saveQ().then(function (result) {
            respond(res, 200, result);
        });
    }).catch(function (err) {
        app.logger.error('Failed to create Comm:', err);
        respond(res, 500);
    }).done();
};

// API: PUT /comm/:id
exports.updateComm = function (req, res) {
    if (!req.body || !req.body.comm) {
        respond(res, 400);
        return;
    } else if (!app.mongoose.Types.ObjectId.isValid(req.params.id)) {
        respond(res, 404);
        return;
    }

    var update = req.body.comm;
    var query = {_id: req.params.id};
    var options = {
        new: true // return updated document from operation
    };
    // don't allow _id or timestamp to be set
    delete update._id;
    delete update.timestamp;
    // TODO: only 'add' new entries to the dest array? the way things are set up right now, it probably replaces the array, which may cause a race condition for multiple users

    Comm.findOneAndUpdateQ(query, update, options)
        .then(function (result) {
            if (result) {
                respond(res, 200, result);
            } else {
                respond(res, 404);
            }
        }).catch(function (err) {
            app.logger.error('Failed to update Comm:', err);
            respond(res, 500);
        }).done();
};

// API: DELETE /comm/:id
exports.deleteComm = function (req, res) {
    if (!app.mongoose.Types.ObjectId.isValid(req.params.id)) {
        respond(res, 404);
        return;
    }

    Comm.findByIdAndRemoveQ(req.params.id)
        .then(function (result) {
            if (result) {
                respond(res, 200);
            } else {
                respond(res, 404);
            }
        }).catch(function (err) {
        app.logger.error('Failed to delete Comm:', err);
        respond(res, 500);
    }).done();
};
