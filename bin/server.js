var express = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var config = require(__dirname + '/../config/config.js');

var app = express();
app.set('port', config.port);
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(passport.initialize());
app.use(app.router);

app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function() {
    app.use(express.errorHandler());
});

var Account = require(__dirname + '/../models/account');

//NOTE: createStrategy: Sets up passport-local LocalStrategy with correct options.
//When using usernameField option to specify alternative usernameField e.g. "email"
//passport-local still expects your frontend login form to contain an input with
//name "username" instead of email
//https://github.com/saintedlama/passport-local-mongoose
passport.use(Account.createStrategy());

mongoose.connect(config.mongoUrl);
require(__dirname + '/../routes/routes')(app, passport);
app.listen(app.get('port'), function() {
    console.log(("Express server listening on port " + app.get('port')));
});
