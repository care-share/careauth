'use strict';

// import external modules
var nconf = require('nconf');
var yaml = require('js-yaml');
var revalidator = require('revalidator');
var fs = require('fs');
var url = require('url');

// import internal modules
var app = require('./app');
var schema = require('../config/schema');

module.exports = nconf;

/**
 * Load Javascript configuration file.
 * This code is adapted from the nconf project: https://github.com/flatiron/nconf
 */
nconf.init = function (configFile) {
    app.config.argv().env();

    // config file priority:
    // 1) passed into init by argument (only used by tests)
    // 2) command line authorization or env var
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

    // database URL is determined by object properties, set them manually from environment vars if needed
    if (process.env.db_production)
        app.config.set('db:production', process.env.db_production);
    if (process.env.db_test)
        app.config.set('db:test', process.env.db_test);

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
var jwtParams;
nconf.jwtParameters = function () {
    if (!jwtParams) {
        jwtParams = {
            secret: app.config.get('jwt_secret'),
            options: {
                algorithms: [app.config.get('jwt_signing_alg')],
                expiresInSeconds: app.config.get('jwt_ttl') / 1000
            }
        };
    }
    return jwtParams;
};

// returns parameters for the OpenID Connect server
var openidParams;
nconf.openidParameters = function () {
    if (!openidParams) {
        var domain = app.config.get('domain');
        var tls = app.config.get('use_tls');
        var proto = tls ? 'https' : 'http';
        var port = app.config.get('port');
        if ((port === 80 && proto === 'http') || (port === 443 && proto === 'https'))
            port = '';
        else
            port = ':' + port;
        var baseUrl = proto + 'openid.' + domain + port + '/';
        openidParams = {
            authorizationURL: url.resolve(baseUrl, app.config.get('openid_url_authorization')),
            tokenURL: url.resolve(baseUrl, app.config.get('openid_url_token')),
            userInfoURL: url.resolve(baseUrl, app.config.get('openid_url_user_info')),
            clientID: app.config.get('openid_client_id'),
            clientSecret: app.config.get('openid_client_secret'),
            callbackURL: proto + domain + port + '/',
            identifierField: 'openid_identifier',
            scope: 'profile email', // https://openid.net/specs/openid-connect-basic-1_0.html#Scopes
            scopeSeparator: ' ',
            passReqToCallback: true,
            skipUserProfile: false
        };
    }
    return openidParams;
};

// returns the proxy table for the proxy listener
var proxyOpts;
nconf.proxyOptions = function () {
    if (!proxyOpts) {
        // get settings from config file
        var domain = app.config.get('domain');
        var tls = app.config.get('use_tls');
        var proto = tls ? 'https' : 'http';
        var proxyCareShare = app.config.get('proxy_careshare');
        var proxyFHIR = app.config.get('proxy_fhir');
        var proxyOpenID = app.config.get('proxy_openid');

        // set defaults
        if (!proxyCareShare)
            proxyCareShare = proto + '://' + domain + ':4200';
        if (!proxyFHIR)
            proxyFHIR = proto + '://' + domain + ':8080/hapi-fhir/base';
        if (!proxyOpenID)
            proxyOpenID = proto + '://' + domain + ':8888/openid';

        // return options
        var options = {};
        options[domain] = options['www.' + domain] = proxyCareShare;
        options['fhir.' + domain] = proxyFHIR;
        options['openid.' + domain] = proxyOpenID;
        options['api.' + domain] = proto + '://' + domain + ':3001';
        proxyOpts = options;
    }
    return proxyOpts;
};
