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
    role: 'admin',
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

    Account.register(user, password, function(err, account) {
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
