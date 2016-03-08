'use strict';

// import internal modules
var app = require('../../lib/app');
var Comm = app.Comm;
var respond = require('../../lib/utils').respond;

// API: GET /comm ? careplan_id|patient_id|resource_id [& limit]
exports.getComms = function (req, res) {
    var query = {};
    if (req.query.careplan_id) {
        query.careplan_id = req.query.careplan_id;
    } else if (req.query.patient_id) {
        query.patient_id = req.query.patient_id;
    } else if (req.query.resource_id) {
        query.resource_id = req.query.resource_id;
    } else {
        respond(res, 400); // bad request
        return;
    }

    var options = {sort: {timestamp: -1}};
    if (req.query.limit) {
        options.limit = req.query.limit;
    }

    // get Comm models from Mongo
    Comm.find(query).lean().execQ().then(function (comms) {
        respond(res, 200, comms);
    }).catch(function (err) {
        app.logger.error('Failed to find Comms for query "%s":', JSON.stringify(query), err);
        respond(res, 500);
    }).done();
};

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
    // set the src user ID
    args.src_user_id = req.user.id;

    var model = new Comm(args);
    model.saveQ().then(function (result) {
        respond(res, 200, result);
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
    //delete update.timestamp;

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
