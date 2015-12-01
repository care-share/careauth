'use strict';

// import internal modules
var app = require('../../lib/app');

/**
* @module Routes
*/

module.exports = function (server, passport) {
    // import controllers
    var account = require('../controllers/account');
    var auth = require('../controllers/auth');
    var user = require('../controllers/user');

    server.get('/', function (req, res) {
        res.send('Go away');
    });

    ///////////////////////////////////////////////////////////////////////////
    // ACCOUNT CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    server.route('/auth/register')
        .post(account.register);

    server.route('/auth/login')
        .post(passport.authenticate('local', {session: false}), account.login);

    server.route('/auth/openid')
        .get(passport.authenticate('openidconnect'), account.login);

    server.route('/auth/logout')
        .post(auth.checkToken, account.logout);

    ///////////////////////////////////////////////////////////////////////////
    // USER CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    // gets list of valid user roles
    server.route('/users/roles')
        .get(auth.checkAdminToken, user.listUserRoles);

    // gets list of user accounts to approve
    server.route('/users/:approval')
        .get(auth.checkAdminToken, user.findUsersByApproval);

    // approves a user account
    // params:
    //  * email: email of user to approve
    server.route('/users/:email/approve')
        .post(auth.checkAdminToken, user.approveUser);

    // adds or removes a role from a user
    // params:
    //  * email: email of user to change
    //  * role: role to change for user
    server.route('/users/:email/roles/:role')
        .put(auth.checkAdminToken, user.addUserRole)
        .delete(auth.checkAdminToken, user.removeUserRole);

    // changes a user's email
    // params:
    // * email: email of user to change
    // * new_email: new email for user
    server.route('/users/:email/email/:new_email')
        .put(auth.checkAdminOrOwnerToken,user.changeUserEmail);

    // changes a user's first name
    // params:
    // * email: email of user to change
    // * first_name: new first name for user
    server.route('/users/:email/name_first/:name_first')
        .put(auth.checkAdminOrOwnerToken,user.changeUserFirstName);

    // removes a user's first name
    // params:
    // * email: email of user to change
    server.route('/users/:email/name_first')
        .delete(auth.checkAdminOrOwnerToken,user.removeUserFirstName);

    // changes a user's last name
    // params:
    // * email: email of user to change
    // * name_last: new last name of user
    server.route('/users/:email/name_last/:name_last')
        .put(auth.checkAdminOrOwnerToken,user.changeUserLastName);

    // removes a user's last name
    // params:
    // * email: email of user to change
    server.route('/users/:email/name_last')
        .delete(auth.checkAdminOrOwnerToken,user.removeUserLastName);

    // changes a user's FHIR ID
    // params:
    //  * email: email of user to change
    //  * fhir_id: new FHIR ID for user
    server.route('/users/:email/fhir_id/:fhir_id')
        .put(auth.checkAdminToken, user.changeUserFhirId);

    // removes a user's FHIR ID
    // params:
    // * email: email of user to change
    server.route('/users/:email/fhir_id')
        .delete(auth.checkAdminToken,user.removeUserFhirId);

    // deletes a user
    // params:
    //  * email: email of user to delete
    server.route('/users/:email')
        .delete(auth.checkAdminToken, user.deleteUser);

    // updates the user's password
    // params:
    // * email: email of user to change
    // * newPassword: new password for user
    server.route('/users/:email/password/:newPassword')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPassword);
};
