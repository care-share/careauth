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

    server.route('/auth/logout')
        .post(auth.checkToken, account.logout);

    ///////////////////////////////////////////////////////////////////////////
    // USER CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    // gets list of user accounts to approve
    server.route('/users/:approval')
        .get(auth.checkAdminToken, user.findUsersByApproval);

    // approves a user account
    // params:
    //  * email: email of user to approve
    server.route('/users/:email/approve')
        .post(auth.checkAdminToken, user.approveUser);

    // changes a user's role
    // params:
    //  * email: email of user to change
    //  * role: new role for user
    server.route('/users/:email/role/:role')
        .post(auth.checkAdminToken, user.changeUserRole);

    // changes a user's role
    // params:
    //  * email: email of user to change
    //  * role: new role for user
    server.route('/users/:email')
        .delete(auth.checkAdminToken, user.deleteUser);
};
