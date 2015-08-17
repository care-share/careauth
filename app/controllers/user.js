'use strict';

// import external modules
var Q = require('q');

// import internal modules
var app = require('../../lib/app');
var Account = app.Account;
var respond = require('../../lib/utils').respond;

exports.findUsersByApproval = function (req, res) {
    var approval = req.params.approval;
    if (!approval || (approval !== 'approved' && approval !== 'unapproved')) {
        respond(res, 404);
        return;
    }

    var query = {approved: approval === 'approved'};
    return Q.ninvoke(Account, 'find', query, 'email name_first name_last role')
    .then(function (result) {
        respond(res, 200, result);
    }).catch(function (err) {
        app.logger.error('Failed to update user:', err);
        respond(res, 500);
    }).done();
};

exports.approveUser = function (req, res) {
    var email = req.params.email;
    if (!email) {
        respond(res, 400);
        return;
    }

    var query = {email: email};
    var update = {approved: true};
    return Q.ninvoke(Account, 'findOneAndUpdate', query, update)
    .then(function (result) {
        if (result) {
            respond(res, 200);
        } else {
            respond(res, 404);
        }
    }).catch(function (err) {
        app.logger.error('Failed to update user:', err);
        respond(res, 500);
    }).done();
};