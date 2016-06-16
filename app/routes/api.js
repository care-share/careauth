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

/**
 * @module Routes
 */

module.exports = function (server, passport) {
    // import controllers
    var account = require('../controllers/account');
    var auth = require('../controllers/auth');
    var clone = require('../controllers/clone');
    var user = require('../controllers/user');
    var comm = require('../controllers/comm');
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
    // COMM CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    server.route('/comms')
        .get(auth.checkToken, comm.getComms)
        .post(auth.checkToken, comm.createComm);

    server.route('/comms/:id')
        .put(auth.checkToken, comm.updateComm)
        .delete(auth.checkToken, comm.deleteComm);

    ///////////////////////////////////////////////////////////////////////////
    // MEDREC CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    // accessed by HH users
    // returns a single MedPair for a draft MedEntry (i.e. a MedEntry that has not been saved yet)
    // format: {homeMed: MedPair, ehrMed: MedicationOrder, status: String, discrepancy: {attr1: Boolean, attr2: Boolean, ...}}
    server.route('/medpairs/patient_id/:patient_id')
        .post(auth.checkToken, medrec.getMedPairForMedEntry);

    // accessed by VA users
    // returns all of the OUTSTANDING MedPairs for a given Patient
    // format: [{homeMed: MedPair, ehrMed: MedicationOrder, status: String, discrepancy: {attr1: Boolean, attr2: Boolean, ...}}]
    server.route('/medrecs/patient_id/:patient_id')
        .get(auth.checkToken, medrec.getMedRecForPatient);

    // accessed by Home Health users
    // returns all of the COMPLETED MedPairs for a given Patient, that were created by the logged-in User
    // format: [{homeMed: MedPair, ehrMed: MedicationOrder}]
    server.route('/actionlist/patient_id/:patient_id')
        .get(auth.checkToken, medrec.findActionList);

    // create multiple MedEntry models
    server.route('/medentries')
        .post(auth.checkToken, medrec.saveMedEntries);

    // update a MedEntry
    server.route('/medentries/:id')
        .put(auth.checkToken, medrec.changeMedEntry);

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
    server.route('/profile/users/:id/update')
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


    // updates a user's profile picture
    // params:
    // * email: email of user to change
    // * pictureLocation:location of new profile picture
    server.route('/profile/users/:id/picture')
        .post(auth.checkAdminOrOwnerToken,upload.single('image'),user.changeUserPicture);

    // deletes a user's profile picture
    // params:
    // * email: email of user to change
    server.route('profile/users/:id/picture')
        .delete(auth.checkAdminOrOwnerToken, user.removeUserPicture);

    ///////////////////////////////////////////////////////////////////////////
    // CLONE CONTROLLER
    ///////////////////////////////////////////////////////////////////////////

    server.route('/clone/patient_id/:patient_id')
        .post(auth.checkToken, clone.clonePatient);
};
