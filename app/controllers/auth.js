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
var auth = require('../../lib/auth');

// makes sure a user is logged in
exports.checkToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next);
};

// make sure a user is an admin
exports.checkAdminToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, true);
};

// makes sure a user is an admin, or is the owner of this resource
exports.checkAdminOrOwnerToken = function (req, res, next) {
    auth.checkTokenWeb(req, res, next, true, req.params.id);
};
