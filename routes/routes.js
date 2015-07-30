'use strict';

var path = require('path');
var config = require(path.join(__dirname, '..', '/config/config.js'));
var Account = require(path.join(__dirname, '..', '/models/account'));
var Token = require(path.join(__dirname, '..', '/models/account')).Token;
var flash = require(path.join(__dirname, '..', '/include/utils')).flash;

/**
* @module Routes
*/

module.exports = function (app, passport) {

    app.get('/', function (req, res) {
        res.send('Go away');
    });

    app.post('/register', function(req, res) {
        var name_first = req.body.name_first;
        var name_last = req.body.name_last;
        var email = req.body.email;
        var password = req.body.password;
        if (!name_first || !name_last || !email || !password) {
            res.send(400).json({message: 'Bad request'});
        }

        var user = new Account({name_first: name_first, name_last: name_last, email: email});
        Account.register(user, password, function(err, account) {
            if (err) {
                if (err.name === 'BadRequesterror' && err.message && err.message.indexOf('exists') > -1) {
                    // user already exists
                    res.send(409).json({message: 'Conflict'});
                }
                else if (err.name === 'BadRequesterror' && err.message && err.message.indexOf('argument not set')) {
                    res.send(400).json({message: 'Bad Request'});
                }
                else {
                    res.send(201).json({message: 'Internal Server Error'});
                }

                res.send(code).json(message);
            } else {
                res.send(201).json({message: 'Created'});
            }
        });
    });

    app.post('/login', passport.authenticate('local', {session: false}), function(req, res) {
        if (req.user) {
            Account.createUserToken(req.user.email, function(err, usersToken) {
                if (err) {
                    // couldn't generate token
                    res.send(500).json({message: 'Internal Server Error'});
                } else {
                    res.json({token : usersToken});
                }
            });
        } else {
            res.send(401).json({message: 'Unauthorized'});
        }
    });

/*
    app.get('/apitest', function(req, res) {
        var incomingToken = req.headers.token;
        console.log('incomingToken: ' + incomingToken);
        var decoded = Account.decode(incomingToken);
        //Now do a lookup on that email in mongodb ... if exists it's a real user
        if (decoded && decoded.email) {
            Account.findUser(decoded.email, incomingToken, function(err, user) {
                if (err) {
                    console.log(err);
                    res.send(404).json({error: 'Issue finding user.'});
                } else {
                    if (Token.hasExpired(user.token.date_created)) {
                        console.log("Token expired...TODO: Add renew token funcitionality.");
                        res.json({error: 'Token expired. You need to log in again.'});
                    } else {
                        res.json({
                            user: {
                                email: user.email,
                                full_name: user.full_name,
                                token: user.token.token,
                                message: "This is just a simulation of an API endpoint; and we wouldn't normally return the token in the http response...doing so for test purposes only :)"
                            }
                        });
                    }
                }
            });
        } else {
            console.log('Whoa! Couldn\'t even decode incoming token!');
            res.send(400).json({error: 'Issue decoding incoming token.'});
        }
    });
*/

    app.get('/logout(\\?)?', function(req, res) {
        var incomingToken = req.headers.token;
        if (!incomingToken) {
            res.send(400).json({message: 'Bad Request'});
        }

        if (incomingToken) {
            var decoded = Account.decode(incomingToken);
            if (decoded && decoded.email) {
                Account.invalidateUserToken(decoded.email, function(err, user) {
                    if (err) {
                        res.send(404).json({error: 'Not Found'});
                    } else {
                        res.json({message: 'OK'});
                    }
                });
            } else {
                // couldn't decode token
                res.send(400).json({message: 'Bad Request'});
            }
        }
    });

/*
    app.post('/forgot', function(req, res) {

        Account.generateResetToken(req.body.email, function(err, user) {
            if (err) {
                res.json({error: 'Issue finding user.'});
            } else {
                var token = user.reset_token;
                var resetLink = 'http://localhost:1337/reset/'+ token + '/' + user.email ;

                //TODO: This is all temporary hackish. When we have email configured
                //properly, all this will be stuffed within that email instead :)
                res.send('<h2>Reset Email (simulation)</h2><br><p>To reset your password click the URL below.</p><br>' +
                '<a href=' + resetLink + '>' + resetLink + '</a><br>' +
                'If you did not request your password to be reset please ignore this email and your password will stay as it is.');
            }
        });
    });

    app.get('/reset/:id/:email', function(req, res) {
        console.log('GOT IN /reset/:id...');
        var token = req.params.id,
            email = req.params.email,
            messages = flash(null, null);

        if (!token) {
            console.log('Issue getting reset :id');
            //TODO: Error response...
        }
        else {
            console.log('In ELSE ... good to go.');
            //TODO
            //
            //1. find user with reset_token == token .. no match THEN error
            //2. check now.getTime() < reset_link_expires_millis
            //3. if not expired, present reset password page/form
            res.render('resetpass', {email: email});
        }
    });


    app.post('/reset/password', function(req, res) {
        console.log("GOT IN")
        var email = req.body.email;
        var currentPassword = req.body.current_password;
        var newPassword = req.body.new_password;
        var confirmationPassword = req.body.confirm_new_password;
        // console.log("email: ", email);
        // console.log("currentPassword: ", currentPassword);
        // console.log("newPassword: ", newPassword);
        // console.log("confirmationPassword: ", confirmationPassword);

        if (email && currentPassword && newPassword && confirmationPassword && (newPassword === confirmationPassword)) {

            Account.findUserByEmailOnly(email, function(err, user) {
                if (err) {
                    console.log("error: ", err);
                    res.json({err: 'Issue while finding user.'});
                } else if (!user) {
                    console.log("Unknown user");
                    res.json({err: 'Unknown user email: ' + email});
                } else if (user) {
                    console.log("FOUND USER .. now going call Account.authenticate...");
                    Account.authenticate()(email, currentPassword, function (err, isMatch, options) {
                        if (err) {
                            console.log("error: ", err);
                            res.json({err: 'Error while verifying current password.'});
                        } else if (!isMatch) {
                            res.json({err: 'Current password does not match'});
                        } else {
                            user.setPassword(newPassword, function(err, user) {
                                if (err) {
                                    console.log("error: ", err);
                                    res.json({err: 'Issue while setting new password.'});
                                }
                                user.save(function(err, usr) {
                                    if (err) {
                                        cb(err, null);
                                    } else {
                                        //TODO, client will redirect to Login page (they won't have a current token)
                                        res.json({message: 'Password updated.'});
                                    }
                                });
                            });
                        }
                    });
                }
            });
        } else {
            //TODO Better error message,etc.
            res.json({error: 'Missing email, current, new, or confirmation password, OR, the confirmation does not match.'});
        }
    });
*/

};
