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

/**
 * Main namespace object used through-out the app.
 */
var app = {};

module.exports = app;

/**
 * Current version used. Read from package.json
 * @type {String}
 */
app.VERSION = require('../package.json').version;

/**
 * Called at start of App.  Initializes the core modules
 */
app.init = function () {

    /**** Setup ****/

    // Winston and wrap in out global name space
    app.logger = require('./logger');
    app.logger.beforeConfig();

    // Config with validation
    app.config = require('./config');
    app.config.init();

    app.logger.afterConfig();

    // Database connection
    app.mongoose = require('mongoose-q')();

    if (!app.mongoose.connection.db) {
        var dbname;

        if (process.env.NODE_ENV === 'production') {
            dbname = app.config.get('db:production');
        } else {
            dbname = app.config.get('db:test');
        }
        app.mongoose.connect(dbname);
        app.logger.info("Mongoose: connected to: %s", dbname);

        app.mongoose.connection.on('error', function (err) {
            app.logger.error("Problem connecting to mongdb. Is it running? ", err);
            process.exit(1);
        });
        app.mongoose.connection.on('disconnected', function () {
            app.logger.info("Mongoose: disconnected connection");
        });

    }

    // Models
    app.Account = require('./model/account')(app.mongoose);
    app.MedEntry = require('./model/medentry')(app.mongoose);
    app.Comm = require('./model/comm')(app.mongoose);

    // Add Access Control List (ACL)
    app.acl = require('./acl')();
};

/**
 * Shut down. Closes DB connection and cleans up any temp config settings
 */
app.shutdown = function () {
    app.config.reset();

    if (app.mongoose.connection) {
        app.mongoose.connection.close();
    }
};