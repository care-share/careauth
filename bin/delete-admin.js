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