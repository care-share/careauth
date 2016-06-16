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
var app = require('../lib/app');

// initialize the app object
app.init();
var Account = app.Account;

Account.findOneAndRemove({email: app.config.get('admin_user')}, function (err, user) {
    if (err) {
        app.logger.error('Failed to delete admin user:', err);
        process.exit(1);
    } else if (!user) {
        app.logger.error('Failed to delete admin user: User not found');
        process.exit(1);
    } else {
        app.logger.info('Deleted user: {email: "%s"}', user.email);
        process.exit(0);
    }
});