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