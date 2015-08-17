'use strict';

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
    Account.findQ(query, 'email name_first name_last role')
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
    Account.findOneAndUpdateQ(query, update)
    .then(function (result) {
        if (result) {
            // TODO: send an email to the user informing them that their account has been approved
            respond(res, 200);
        } else {
            respond(res, 404);
        }
    }).catch(function (err) {
        app.logger.error('Failed to update user:', err);
        respond(res, 500);
    }).done();
};