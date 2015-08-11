var crypto = require('crypto');
var mongoose = require('mongoose');
var passport = require('passport');
var xkcdPassword = require('xkcd-password');
var config = require(__dirname + '/../config/config.js');

var Account = require(__dirname + '/../models/account');

//NOTE: createStrategy: Sets up passport-local LocalStrategy with correct options.
//When using usernameField option to specify alternative usernameField e.g. "email'
//passport-local still expects your frontend login form to contain an input with
//name "username" instead of email
//https://github.com/saintedlama/passport-local-mongoose
passport.use(Account.createStrategy());

mongoose.connect(config.mongoUrl);

var user = new Account({
    name_first: 'firstname',
    name_last: 'lastname',
    email: config.adminUser,
    role: 'admin',
    approved: true
});

if (config.adminPassword) {
    createUser(config.adminPassword);
} else {
    var pw = new xkcdPassword();
    var options = {
        numWords: 4,
        minLength: 5,
        maxLength: 8
    };
    pw.generate(options, function (err, result) {
        if (err) {
            console.error('Unable to generate password!', err);
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
                console.error('Failed to create admin user: User already exists');
            }
            else if (err.name === 'BadRequestError' && err.message && err.message.indexOf('argument not set')) {
                console.error('Failed to create admin user: Missing argument');
            }
            else {
                console.error('Failed to create admin user:', err);
            }
        } else {
            console.log('Created user: {email: "%s", password: "%s"}', user.email, password);
        }
    });
}
