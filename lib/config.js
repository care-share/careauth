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
    } else {
        app.config.configTls();
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

/**
 * Configure TLS options
 */
nconf.configTls = function () {
    if (app.config.get('use_tls') == 'true') {
        // private key file (PFX/P12) contains Certificate, Private key and CA certificates to use for TLS encryption
        var privateKeyPath = app.config.get('tls_keystore_file');
        var passPhrase = app.config.get('tls_keystore_pass');

        var options = {};

        try {
            var tls_key = fs.readFileSync(privateKeyPath);
        } catch (err) {
            app.logger.error("Could not open TLS private key '%s' (check config.tls_keystore_file)", privateKeyPath);
            process.exit(1);
        }
        options.type = 'tls';
        // TODO: choose protocol (TLSv1.2?)
        options.pfx = tls_key;
        options.passphrase = passPhrase;
        options.honorCipherOrder = true;
        options.ciphers =
            "AES128-SHA:" +                    // TLS_RSA_WITH_AES_128_CBC_SHA
            "AES256-SHA:" +                    // TLS_RSA_WITH_AES_256_CBC_SHA
            "AES128-SHA256:" +                 // TLS_RSA_WITH_AES_128_CBC_SHA256
            "AES256-SHA256:" +                 // TLS_RSA_WITH_AES_256_CBC_SHA256
            "ECDHE-RSA-AES128-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA
            "ECDHE-RSA-AES256-SHA:" +          // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
            "DHE-RSA-AES128-SHA:" +            // TLS_DHE_RSA_WITH_AES_128_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA:" +            // TLS_DHE_RSA_WITH_AES_256_CBC_SHA, should use at least 2048-bit DH
            "DHE-RSA-AES128-SHA256:" +         // TLS_DHE_RSA_WITH_AES_128_CBC_SHA256, should use at least 2048-bit DH
            "DHE-RSA-AES256-SHA256:" +         // TLS_DHE_RSA_WITH_AES_256_CBC_SHA256, should use at least 2048-bit DH
            "ECDHE-ECDSA-AES128-SHA256:" +     // TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-SHA384:" +     // TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384, should use elliptic curve certificates
            "ECDHE-ECDSA-AES128-GCM-SHA256:" + // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, should use elliptic curve certificates
            "ECDHE-ECDSA-AES256-GCM-SHA384:" + // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, should use elliptic curve certificates
            "@STRENGTH";

        app.config.set('tls_options', options);
    }
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
        var tls = app.config.get('use_tls') == 'true'; // value may be a string instead of boolean...
        var proto = tls ? 'https' : 'http';
        var port = app.config.get('port');
        if ((port == '80' && proto === 'http') || (port == '443' && proto === 'https'))
            port = '';
        else
            port = ':' + port;
        var baseUrl = proto + '://openid.' + domain + port + '/';
        openidParams = {
            authorizationURL: url.resolve(baseUrl, app.config.get('openid_url_authorization')),
            tokenURL: url.resolve(baseUrl, app.config.get('openid_url_token')),
            userInfoURL: url.resolve(baseUrl, app.config.get('openid_url_user_info')),
            clientID: app.config.get('openid_client_id'),
            clientSecret: app.config.get('openid_client_secret'),
            callbackURL: proto + '://remote.' + domain + port + '/',
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
        var tls = app.config.get('use_tls') == 'true'; // value may be a string instead of boolean...
        var proto = tls ? 'https' : 'http';
        var proxyCareShare = app.config.get('proxy_careshare');
        var proxyCareShareRemote = app.config.get('proxy_careshare_remote');
        var proxyFHIR = app.config.get('proxy_fhir');
        var proxyOpenID = app.config.get('proxy_openid');
        var proxyAPI = app.config.get('proxy_api');

        // set defaults
        if (!proxyCareShare)
            proxyCareShare = proto + '://' + domain + ':4200';
        if (!proxyCareShareRemote)
            proxyCareShareRemote = proto + '://' + domain + ':4201';
        if (!proxyFHIR)
            proxyFHIR = proto + '://' + domain + ':8080/base';
        if (!proxyOpenID)
            proxyOpenID = proto + '://' + domain + ':8888';
        if (!proxyAPI)
            proxyOpenID = proto + '://' + domain + ':3001';

        // return options
        var options = {};
        options[domain] = options['www.' + domain] = proxyCareShare;
        options['remote.' + domain] = proxyCareShareRemote;
        options['fhir.' + domain] = proxyFHIR;
        options['openid.' + domain] = proxyOpenID;
        options['api.' + domain] = proxyAPI;
        proxyOpts = options;
    }
    return proxyOpts;
};

