var mongoose = require('mongoose');
var config = require(__dirname + '/../config/config.js');

var Account = require(__dirname + '/../models/account');

//NOTE: createStrategy: Sets up passport-local LocalStrategy with correct options.
//When using usernameField option to specify alternative usernameField e.g. "email"
//passport-local still expects your frontend login form to contain an input with
//name "username" instead of email
//https://github.com/saintedlama/passport-local-mongoose

mongoose.connect(config.mongoUrl);

Account.findOneAndRemove({email: config.adminUser}, function(err, user) {
    if (err) {
        console.error('Failed to delete admin user:', err);
    } else if (!user) {
        console.error('Failed to delete admin user: User not found');
    } else {
        console.log('Deleted user: {email: "%s"}', user.email);
    }
});