var
    app = require('./app'),
    nconf = require('nconf'),
    yaml = require('js-yaml'),
    revalidator = require('revalidator'),
    schema = require('../config/schema'),
    fs = require('fs');

module.exports = nconf;

/**
 * Load Javascript configuration file.
 * This code is adapted from the nconf project: https://github.com/flatiron/nconf
 */
nconf.init = function (configFile) {
    app.config.argv().env();

    // config file priority:
    // 1) passed into init by argument (only used by tests)
    // 2) command line arg or env var
    // 3) default config/config-local.yaml

    configFile = typeof configFile !== 'undefined' ? configFile : app.config.get("config");

    if (typeof configFile === 'undefined') {

        // neither 1 or 2 was specified, try the default
        configFile = __dirname + '/../config/config-local.yml';

        // If the file isn't there, we got you covered - create a default for the User
        if (!fs.existsSync(configFile)){

            var configStub = fs.readFileSync(__dirname + '/../config/_config-local.yml');
            fs.writeFileSync(configFile, configStub);

            console.log('\x1b[31m', 'Created config-local.yml. Update with your local settings and restart the app');

            process.exit(1);
        }
    }

    // Double check to make sure that what ever file we're using is there...
    if (!fs.existsSync(configFile)) {
        app.logger.error('Config file does not exist: %s', configFile);
        process.exit(1);
    }

    app.logger.info('Loading config file: %s', configFile);

    app.config.file({
        file: configFile,
        format: {
            parse: yaml.safeLoad,
            stringify: yaml.safeDump
        }
    });

    // Validate config against schema
    var validation = revalidator.validate(app.config.stores.file.store, schema);
    if (!validation.valid) {
        validation.errors.forEach(function (e) {
            app.logger.error(JSON.stringify(e, null, 2));
        });
        process.exit(1);
    }
};

/**
 * Is the given key enabled (true or false?)
 * @param key
 * @returns {boolean}
 */
nconf.isEnabled = function (key) {
    return app.config.get(key) === true;
};

/**
 * Is the given key disabled?
 * @param key
 * @returns {boolean}
 */
nconf.isDisabled = function (key) {
    return app.config.get(key) === false;
};

// returns parameters for processing JSON Web Tokens
nconf.jwtParameters = function () {
    return {
        secret: app.config.get('jwt_secret'),
        options: {
            algorithms: [app.config.get('jwt_signing_alg')]
        }
    };
};
