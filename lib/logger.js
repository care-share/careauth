var
    winston = require('winston'),
    app = require('./app');

module.exports = winston;

winston.beforeConfig = function () {
    winston.remove(winston.transports.Console);
    winston.add(winston.transports.Console, {level: 'info', colorize: true, timestamp: true});
};

winston.afterConfig = function () {
    var logLevel = app.config.get('log_level');
    var logFile = app.config.get('log_file');

    winston.remove(winston.transports.Console);
    winston.add(winston.transports.Console, {level: logLevel, colorize: true, timestamp: true});
    winston.add(winston.transports.File, {filename: logFile, level: logLevel, json: false, timestamp: true});
};

module.exports.stream = {
    write: function(message, encoding){
        winston.info(message.trim());
    }
};