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
    //  * role: new role for user
    server.route('/users/:email/roles/:role')
        .put(auth.checkAdminToken, user.addUserRole)
        .delete(auth.checkAdminToken, user.removeUserRole);

    // deletes a user
    // params:
    //  * email: email of user to delete
    server.route('/users/:email')
        .delete(auth.checkAdminToken, user.deleteUser);
};
