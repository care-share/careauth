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

    // gets list of user accounts that have been approved
    server.route('/users/approved')
        .get(auth.checkAdminToken, user.findUsersApproved);

    // gets list of user accounts that have not been approved yet
    server.route('/users/unapproved')
        .get(auth.checkAdminToken, user.findUsersUnapproved);

    // gets the authenticated user
    server.route('/users/self')
        .get(auth.checkToken, user.findUserSelf);

    // gets a specific user by ID
    server.route('/users/:id')
        .get(auth.checkAdminOrOwnerToken, user.findUserById);

    // approves a user account
    // params:
    //  * email: email of user to approve
    server.route('/users/:id/approve')
        .post(auth.checkAdminToken, user.approveUser);

    // adds or removes a role from a user
    // params:
    //  * email: email of user to change
    //  * role: role to change for user
    server.route('/users/:id/roles/:role')
        .put(auth.checkAdminToken, user.addUserRole)
        .delete(auth.checkAdminToken, user.removeUserRole);

    // changes a user's email
    // params:
    // * email: email of user to change
    // * new_email: new email for user
    server.route('/users/:id/email/:email')
        .put(auth.checkAdminOrOwnerToken, user.changeUserEmail);

    // changes a user's first name
    // params:
    // * email: email of user to change
    // * first_name: new first name for user
    server.route('/users/:id/name_first/:name_first')
        .put(auth.checkAdminOrOwnerToken, user.changeUserFirstName);

    // changes a user's last name
    // params:
    // * email: email of user to change
    // * name_last: new last name of user
    server.route('/users/:id/name_last/:name_last')
        .put(auth.checkAdminOrOwnerToken, user.changeUserLastName);

    // changes a user's FHIR ID
    // params:
    //  * email: email of user to change
    //  * fhir_id: new FHIR ID for user
    server.route('/users/:id/fhir_id/:fhir_id')
        .put(auth.checkAdminToken, user.changeUserFhirId);

    // removes a user's FHIR ID
    // params:
    // * email: email of user to change
    server.route('/users/:id/fhir_id')
        .delete(auth.checkAdminToken, user.removeUserFhirId);

    // deletes a user
    // params:
    //  * email: email of user to delete
    server.route('/users/:id')
        .delete(auth.checkAdminToken, user.deleteUser);

    // updates the user's password
    // params:
    // * email: email of user to change
    // * newPassword: new password for user
    server.route('/users/:id/password/:password')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPassword);

    // updates a user's phone number
    // params:
    // * email: email of user to change
    // * phoneNum: new phone number for user
    server.route('/users/:email/phone/:newPhone')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPhone);

    // deletes a user's phone number
    // params:
    // * email: email of user to change
    server.route('/users/:email/phone')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPhone);

    // updates a user's contact preference
    // params:
    // * email: email of user to change
    // * pref: new contact preference for user
    server.route('/users/:email/contact_pref/:pref')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPref);

    // deletes a user's contact preference
    // params:
    // * email: email of user to change
    server.route('/users/:email/contact_pref')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPref);

    // updates a user's profile picture
    // params:
    // * email: email of user to change
    // * pictureLocation:location of new profile picture
    server.route('/users/:email/picture/:pictureLocation')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPicture);

    // deletes a user's profile picture
    // params:
    // * email: email of user to change
    server.route('/users/:email/picture')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPicture);
};
