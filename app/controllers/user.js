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
    Account.find(query, '-_id email name_first name_last roles origin fhir_id')
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
    updateUser(res, {email: req.params.email}, {approved: true});
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

exports.changeUserEmail = function (req, res) {
    updateUser(res, {email: req.params.email}, {email: req.params.new_email});
};

exports.changeUserFirstName = function (req, res) {
    updateUser(res, {email: req.params.email}, {name_first: req.params.name_first});
};

exports.removeUserFirstName = function (req, res) {
    updateUser(res, {email: req.params.email}, {name_first: undefined});
};

exports.changeUserLastName = function (req, res) {
    updateUser(res, {email: req.params.email}, {name_last: req.params.name_last});
};

exports.removeUserLastName = function (req, res) {
    updateUser(res, {email: req.params.email}, {name_last: undefined});
};

exports.changeUserFhirId = function (req, res) {
    updateUser(res, {email: req.params.email}, {fhir_id: req.params.fhir_id});
};

exports.removeUserFhirId = function (req, res){
    updateUser(res, {email: req.params.email}, {fhir_id: undefined});
};

exports.changeUserPassword = function (req, res){
    //Search for user
    //Once user object == email param
    //setPassword (use callback function)
    var newPassword = req.params.newPassword;
    return Account.findOneQ({email : req.params.email})
        .then(function (result) {
            if (result){
                result.setPassword(newPassword,
                    function (err,thisModel,passwordErr){
                        if(err) {
                            respond(res,500);
                        }
                        if (passwordErr){
                            respond(res,400); //Bad Request response
                        }
                        if(thisModel){
                            thisModel.save();
                            respond(res,200);
                        }
                    })
            } else {
                respond(res,400);
            }
        })
        .catch(function (err) {
            app.logger.error('Failed to change password for user:',err);
            respond(res,500);
        })
        .done();

    //Res = response from
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
    Account.findOneAndRemoveQ({email: req.params.email})
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
