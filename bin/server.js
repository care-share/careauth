// import external modules
var express = require('express'),
    passport = require('passport');

// import internal modules
var app = require('../lib/app'),
    routes = require('../app/routes/routes');

// initialize the app object
app.init();

var server = express();
var port = app.config.get('port');

// allow CORS
// TODO: edit to limit domains instead of using a wildcard
server.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

server.use(express.logger());
server.use(express.bodyParser());
server.use(express.methodOverride());
server.use(passport.initialize());
server.use(server.router);

server.configure('development', function() {
    server.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
server.configure('production', function() {
    server.use(express.errorHandler());
});

//NOTE: createStrategy: Sets up passport-local LocalStrategy with correct options.
//When using usernameField option to specify alternative usernameField e.g. "email"
//passport-local still expects your frontend login form to contain an input with
//name "username" instead of email
//https://github.com/saintedlama/passport-local-mongoose
passport.use(app.Account.createStrategy());

routes(server, passport);
server.listen(port, function() {
    app.logger.info("Express server listening on port %d", port);
});
