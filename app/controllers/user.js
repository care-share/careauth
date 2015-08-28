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
    Account.findQ(query, '-_id email name_first name_last role origin')
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

    updateUser(res, {email: email}, {approved: true});
};

exports.changeUserRole = function (req, res) {
    var email = req.params.email;
    var role = req.params.role;
    if (!email || !role) {
        respond(res, 400);
        return;
    } else if (role !== 'admin' && role !== 'user') {
        respond(res, 400);
        return;
    }

    updateUser(res, {email: email}, {role: role});
};

exports.deleteUser = function (req, res) {
    var email = req.params.email;
    if (!email) {
        respond(res, 400);
        return;
    }

    Account.findOneAndRemoveQ({email: email})
    .then(function (result) {
        if (result) {
            respond(res, 200);
        } else {
            respond(res, 404);
        }
    }).catch(function (err) {
        app.logger.error('Failed to delete user:', err);
        respond(res, 500);
    }).done();
};

// local methods
function updateUser(res, query, update) {
    return Account.findOneAndUpdateQ(query, update)
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
}
