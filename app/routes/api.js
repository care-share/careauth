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
    var medrec = require('../controllers/medrec');
    var multer = require('multer');
    //var upload = multer({ dest: './public/avatars'});
    var storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, './public/avatars')
        },
        filename: function (req, file, cb) {
            cb(null, req.params.id+'.jpg')
        }
    });
    var upload = multer({ storage: storage});


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
    // MEDREC CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    // gets a list of MedRecs for a given FHIR user
    server.route('/medrecs/patient_id/:patient_id')
        .get(auth.checkToken, medrec.findMedRecs);

    // create or update a MedRec
    server.route('/medrecs')
        .post(auth.checkToken, medrec.saveMedRec);

    // delete a MedRec
    server.route('/medrecs/id/:id')
        .delete(auth.checkToken, medrec.deleteMedRec);

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
        .put(auth.checkAdminToken, user.approveUser);

    // updates all of user's information
    // params:
    // * id: id of user to be updated
    server.route('/users/:id/update')
        .post(auth.checkAdminOrOwnerToken, user.changeUserInfo);

    // adds or removes a role from a user
    // params:
    //  * email: email of user to change
    //  * role: role to change for user
    server.route('/users/:id/roles/:role')
        .put(auth.checkAdminToken, user.addUserRole)
        .delete(auth.checkAdminToken, user.removeUserRole);

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
    // * id: email of user to change
    server.route('/users/:id/password')
        .post(auth.checkAdminOrOwnerToken, user.changeUserPassword);

    // updates a user's contact preference
    // params:
    // * email: email of user to change
    // * pref: new contact preference for user
    server.route('/users/:id/contact_pref/:pref')
        .put(auth.checkAdminOrOwnerToken, user.changeUserPref);

    // deletes a user's contact preference
    // params:
    // * email: email of user to change
    server.route('/users/:id/contact_pref')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPref);

    // updates a user's profile picture
    // params:
    // * email: email of user to change
    // * pictureLocation:location of new profile picture
    server.route('/users/:id/picture')
        .post(auth.checkAdminOrOwnerToken,upload.single('image'),user.changeUserPicture);

    // deletes a user's profile picture
    // params:
    // * email: email of user to change
    server.route('/users/:id/picture')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPicture);
};
