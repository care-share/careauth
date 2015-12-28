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
    updateUser(res, {email: req.params.email}, {phone: req.params.newPhone});
};

exports.removeUserPhone = function (req, res) {
    updateUser(res, {email: req.params.email}, {phone: undefined});
};

exports.changeUserPref = function (req, res) {
    updateUser(res, {email: req.params.email}, {contact_pref: req.params.pref});
};

exports.removeUserPref = function (req, res) {
    updateUser(res, {email: req.params.email}, {contact_pref: undefined});
};

exports.changeUserPicture = function (req, res) {
    var fs = require('fs');

    //TODO: Need to implement way to write file at "public/avatars"
    //TODO: Need to implement generation of GUID, assign to avatar
    //TODO: GUID is what is referenced in user model

    //1) Define path
    var path = "../../public/avatars";

    //2) Generate name for file
    var fileName ="pictureName.jpg";

    //3) Write file to location
    var f = fs.createWriteStream(path+fileName,req.params.data, function (err){
        if (err) throw err
        console.log('Wrote ' + fileName + 'at path ' + path);
    });

    //4) Replace picture String in user model

    updateUser(res, {email: req.params.email}, {picture: fileName});
};

exports.removeUserPicture = function (req, res) {
    updateUser(res, {email: req.params.email}, {picture: 'default_picture.jpg'});
};

exports.changeUserPassword = function (req, res) {
    // TODO: validate
    //Search for user
    //Once user object == email param
    //setPassword (use callback function)
    var newPassword = req.params.password;
    return Account.findOneQ({id: req.params.id})
        .then(function (result) {
            if (result) {
                result.setPassword(newPassword,
                    function (err, thisModel, passwordErr) {
                        if (err) {
                            respond(res, 500);
                        }
                        if (passwordErr) {
                            respond(res, 400); //Bad Request response
                        }
                        if (thisModel) {
                            thisModel.save();
                            respond(res, 200);
                        }
                    })
            } else {
                respond(res, 400);
            }
        }).catch(function (err) {
            app.logger.error('Failed to change password for user:', err);
            respond(res, 500);
        }).done();

    //Res = response from
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
