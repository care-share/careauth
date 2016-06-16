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

// import external modules
var xkcdPassword = require('xkcd-password');

// import internal modules
var app = require('../lib/app');

// initialize the app object
app.init();
var Account = app.Account;

var user = new Account({
    name_first: 'firstname',
    name_last: 'lastname',
    email: app.config.get('admin_user'),
    roles: ['user', 'admin', 'physician'],
    approved: true
});

var adminPassword = app.config.get('admin_password');
if (adminPassword) {
    createUser(adminPassword);
} else {
    var pw = new xkcdPassword();
    var options = {
        numWords: 4,
        minLength: 5,
        maxLength: 8
    };
    pw.generate(options, function (err, result) {
        if (err) {
            app.logger.error('Unable to generate password!', err);
        } else {
            var password = result[0] + ' ' + result[1] + ' ' + result[2] + ' ' + result[3];
            createUser(password);
        }
    });
}

// called once we determine the password to use for the new account
function createUser(password) {

    Account.register(user, password, function (err, account) {
        if (err) {
            if (err.name === 'BadRequestError' && err.message && err.message.indexOf('exists') > -1) {
                // user already exists
                app.logger.error('Failed to create admin user: User already exists');
            }
            else if (err.name === 'BadRequestError' && err.message && err.message.indexOf('argument not set')) {
                app.logger.error('Failed to create admin user: Missing argument');
            }
            else {
                app.logger.error('Failed to create admin user:', err);
            }
            process.exit(1);
        } else {
            app.logger.info('Created user: {email: "%s", password: "%s"}', user.email, password);
            process.exit(0);
        }
    });
}
