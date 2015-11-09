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

    // changes a user's FHIR ID (can be undefined)
    // params:
    //  * email: email of user to change
    //  * fhir_id: new FHIR ID for user
    server.route('/users/:email/fhir_id/')
        .put(auth.checkAdminToken, user.changeUserFhirId);
    server.route('/users/:email/fhir_id/:fhir_id')
        .put(auth.checkAdminToken, user.changeUserFhirId);

    // deletes a user
    // params:
    //  * email: email of user to delete
    server.route('/users/:email')
        .delete(auth.checkAdminToken, user.deleteUser);
};
