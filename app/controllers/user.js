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
    Account.find(query, '-_id email name_first name_last roles origin')
    .lean()
    .execQ()
    .then(function (result) {
        /// hacky server-side workaround because Ember computed properties aren't working...
        var allRoles = getUserRoles();
        for(var i = 0; i < result.length; i++) {
            var calculated = [];
            for (var j = 0; j < allRoles.length; j++) {
                calculated.push({
                    key: allRoles[j],
                    value: result[i].roles.indexOf(allRoles[j]) > -1
                });
            }
            result[i].allRoles = calculated;
        }
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

exports.listUserRoles = function (req, res) {
    var result = getUserRoles();
    respond(res, 200, result);
};

exports.addUserRole = function (req, res) {
    changeUserRole(req, res, true);
};

exports.removeUserRole = function (req, res) {
    changeUserRole(req, res, false);
};

function changeUserRole (req, res, add) {
    var email = req.params.email;
    var role = req.params.role;
    var validRoles = getUserRoles();
    if (!email || !role) {
        respond(res, 400);
        return;
    } else if (validRoles.indexOf(role) == -1) {
        respond(res, 400);
        return;
    }

    if (add) {
        // add this role to the user, only if the user does not already have this role
        updateUser(res, {email: email}, {$addToSet: {roles: role}});
    } else {
        // remove this role from the user, only if the user currently has the role
        updateUser(res, {email: email}, {$pullAll: {roles: [role]}});
    }
}

function getUserRoles() {
    return app.Account.schema.path('roles').caster.enumValues;
}

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
