// import external modules
var bodyParser = require('body-parser');
var express = require('express');
var passport = require('passport');

// import internal modules
var app = require('../lib/app');
var routes = require('../app/routes/api');

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

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

// debug logger
var morgan = require('morgan');
morgan.token('remote-user', function(req, res){
    if (req.user)
        return req.user.email;
    return 'null';
});
morgan.token('message', function(req, res) {
    return res.logMessage;
});
server.use(morgan(':remote-addr - :remote-user ":method :url" :status ":message"', { "stream": app.logger.stream }));

server.use(passport.initialize());

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
