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
var respond = require('../../lib/utils').respond;

exports.findUsersApproved = function (req, res) {
    findUsers(req, res, {approved: true});
};

exports.findUsersUnapproved = function (req, res) {
    findUsers(req, res, {approved: false});
};

function findUsers(req, res, query) {
    var filter = app.config.get('user_filter');
    Account.find(query, filter)
        .lean()
        .execQ()
        .then(function (result) {
            /// hacky server-side workaround because Ember computed properties aren't working...
            var allRoles = getUserRoles();
            for (var i = 0; i < result.length; i++) {
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
}

exports.findUserSelf = function (req, res) {
    findUser(req, res, req.user.id);
};

exports.findUserById = function (req, res) {
    findUser(req, res, req.params.id);
};

function findUser(req, res, id) {
    var query = {_id: id};
    var filter = app.config.get('user_filter');
    Account.findOneQ(query, filter)
        .then(function (result) {
            if (result) {
                respond(res, 200, result);
            } else {
                respond(res, 404);
            }
        }).catch(function (err) {
        app.logger.error('Failed to find user:', err);
        respond(res, 500);
    }).done();
}

exports.approveUser = function (req, res) {
    updateUser(res, {_id: req.params.id}, {approved: true});
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
    // TODO: first find user and check to make sure their origin is NOT 'openid' (they cannot change their email)
    // TODO: validate email
    updateUser(res, {_id: req.params.id}, {email: req.params.email});
};

exports.changeUserFirstName = function (req, res) {
    // TODO: validate (make sure it's not empty?)
    updateUser(res, {_id: req.params.id}, {name_first: req.params.name_first});
};

exports.changeUserLastName = function (req, res) {
    // TODO: validate (make sure it's not empty?)
    updateUser(res, {_id: req.params.id}, {name_last: req.params.name_last});
};

exports.changeUserFhirId = function (req, res) {
    updateUser(res, {_id: req.params.id}, {fhir_id: req.params.fhir_id});
};

exports.removeUserFhirId = function (req, res) {
    updateUser(res, {_id: req.params.id}, {fhir_id: undefined});
};

exports.changeUserPhone = function (req, res) {
    updateUser(res, {_id: req.params.id}, {phone: req.params.newPhone});
};

exports.removeUserPhone = function (req, res) {
    updateUser(res, {_id: req.params.id}, {phone: undefined});
};

exports.changeUserPref = function (req, res) {
    updateUser(res, {_id: req.params.id}, {contact_pref: req.params.pref});
};

exports.removeUserPref = function (req, res) {
    updateUser(res, {_id: req.params.id}, {contact_pref: undefined});
};

exports.changeUserPicture = function (req, res) {
    updateUser(res, {_id: req.params.id}, {picture: req.params.id + '.jpg'});
};

exports.removeUserPicture = function (req, res) {
    updateUser(res, {_id: req.params.id}, {picture: 'default_picture.jpg'});
};

exports.changeUserInfo = function (req, res) {
    var update = {};
    for(var i in req.body){
        var key = req.body[i].name;
        var value = req.body[i].value;
        if(key === 'name_first' || key === 'name_last' || key === 'email' || key === 'phone' || key === 'contact_pref') {
            update[key] = value;
        }
    }
    updateUser(res, {_id: req.params.id}, update, true);
};

exports.changeUserPassword = function (req, res) {
    var oldPassword = req.body[0].value;
    var newPassword = req.body[1].value;
    console.log('Old password is '+ oldPassword);
    console.log('New password is ' + newPassword);

    // basic password validation
    if (newPassword.length < 8) {
        // TODO: validation using passport
        respond(res, 400);
        return;
    }
    Account.findOneQ({_id: req.params.id}).then(function (user) {
        if (!user) {
            respond(res, 404);
            return;
        }
        user.authenticate(oldPassword, function (err, user, passportErr) {
            if (err) {
                app.logger.verbose('User %s tried to change password for %s but triggered a crypto error:', req.user.id, req.params.id, err);
                respond(res, 500);
                return;
            } else if (passportErr) {
                app.logger.verbose('User %s tried to change password for %s but triggered a passport error:', req.user.id, req.params.id, passportErr);
                respond(res, 401);
                return;
            } else if (!user) {
                app.logger.verbose('User %s tried to change password for %s but authenticate result is undefined!', req.user.id, req.params.id);
                return;
            }
            user.setPassword(newPassword, function (err, user) {
                if (err) {
                    app.logger.verbose('User %s tried to change password for %s but triggered a validation error:', req.user.id, req.params.id, err);
                    return;
                }
                user.save(function (err) {
                    if (err) {
                        app.logger.error('Failed to save user after changing password:', err);
                        respond(res, 500);
                        return;
                    }
                    respond(res, 200);
                });
            });
        });
    }).catch(function (err) {
        app.logger.error('Failed to change password for user:', err);
        respond(res, 500);
    }).done();
};

function changeUserRole(req, res, add) {
    var id = req.params.id;
    var role = req.params.role;
    var validRoles = getUserRoles();
    if (validRoles.indexOf(role) == -1) {
        respond(res, 400);
        return;
    }

    if (add) {
        // add this role to the user, only if the user does not already have this role
        updateUser(res, {_id: id}, {$addToSet: {roles: role}});
    } else {
        // remove this role from the user, only if the user currently has the role
        updateUser(res, {_id: id}, {$pullAll: {roles: [role]}});
    }
}

function getUserRoles() {
    return app.Account.schema.path('roles').caster.enumValues;
}

exports.deleteUser = function (req, res) {
    Account.findOneAndRemoveQ({_id: req.params.id})
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
function updateUser(res, query, update, replyWithResult) {
    return Account.findOneAndUpdateQ(query, update, replyWithResult ? {new: true} : undefined)
        .then(function (result) {
            if (result) {
                result.token = undefined; // TODO: filter out unwanted properties in a more elegant way
                respond(res, 200, replyWithResult ? result : undefined);
            } else {
                respond(res, 404);
            }
        }).catch(function (err) {
            app.logger.error('Failed to update user:', err);
            respond(res, 500);
        }).done();
}
