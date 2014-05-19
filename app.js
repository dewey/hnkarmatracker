/**
 * Hackernews Karma Tracker
 *
 * This app is tracking the account stats of users who signed up using Redis to store all the collected values and
 * a cronjob to gather new stats every 24hours.
 * @author dewey [https://github.com/dewey]
 */

var express = require('express'),
    http = require('http'),
    redis = require("redis"),
    client = redis.createClient(),
    request = require("request-json"),
    hn = request.newClient('https://hn.algolia.com/api/v1/'),
    moment = require('moment'),
    cron = require('cron').CronJob,
    validator = require('validator'),
    async = require('async'),
    config = require('./package.json'),
    path = require('path');

var app = express();

// Setting up Express
app.set('port', process.env.PORT || 3008);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));


// Development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
    app.locals.pretty = true;
}

// Render the index page
app.get('/', function(req, res) {
    res.render('index', {
        title: config.app.title
    });
});

// Render the signup page. The exists parameter is used to determine if we should
// display the error message (User already in the system) or not.
app.get('/user/signup', function(req, res) {
    res.render('signup', {
        title: config.app.title,
        exists: req.query.exists
    });
});

// Check if a user is in the database and show the profile if that's the case.
// Redirect to signup page if there's no account match.
app.post('/user/show', function(req, res) {
    var hnusername = req.body.hnusername;

    if (hnusername.length > 1 && hnusername.length < 50) {
        client.sismember(config.app.redis.prefix + "-users", hnusername, function(err, reply) {

            // If user is already in the system
            if (reply == 1) {
                // Overwrite URL
                res.location('/user/' + hnusername);

                // And forward to success page
                res.redirect('/user/' + hnusername);
            } else {
                // Overwrite URL
                res.location('/user/signup');

                // And forward to success page
                res.redirect('/user/signup?exists=no');
            }
        });
    } else {
        // Overwrite URL
        res.location('/');

        // And forward to success page
        res.redirect('/');
    }
});

// The form action for the signup form. Make sure it's a legal username and if that's the case
// add it to the database.
app.post('/user/add', function(req, res) {
    var hnusername = req.body.hnusername;
    var timestamp = moment().unix();

    if (validator.isAlphanumeric(hnusername) && hnusername.length > 1 && hnusername.length < 50) {
        hn.get("users/" + hnusername, function(err, response, body) {
            if (!err) {
                // Check if user is already in the database
                client.exists(config.app.redis.prefix + "-" + hnusername, function(err, reply) {
                    if (!err) {
                        if (reply == 1) {
                            console.log("[HN Tracker] User already exists. Redirecting to user page.")

                            // Fetching new stats
                            fetchStats(hnusername)

                            // Overwrite URL
                            res.location('/user/' + hnusername);

                            // And forward to success page
                            res.redirect('/user/' + hnusername);
                        } else {
                            console.log("[HN Tracker] Adding new user")
                            client.hmset(config.app.redis.prefix + "-" + hnusername, "created", timestamp);
                            client.sadd(config.app.redis.prefix + "-users", hnusername);

                            // Fetching new stats
                            fetchStats(hnusername)

                            // Overwrite URL
                            res.location('/user/' + hnusername);

                            // And forward to success page
                            res.redirect('/user/' + hnusername);
                        }
                    } else {
                        console.log("[Redis] " + err)
                    }
                });
            } else {
                console.log("[HN Tracker] Error: Not a valid username.");

                // Overwrite URL
                res.location('/user/signup');

                // And forward to success page
                res.redirect('/user/signup');
            }
        });
    } else {
        // Overwrite URL
        res.location('/user/signup');

        // And forward to success page
        res.redirect('/user/signup');

        console.log("[HN Tracker] Error: Not a valid username.");
    }
});

// Debug function to manually refresh the stats. Would mess up the values provided by the daily cronjob.
app.get('/user/:username/refresh', function(req, res) {
    var hnusername = req.params.username;

    // Uncomment for debug purposes only
    // fetchStats(hnusername);

    // Overwrite URL
    res.location('/user/' + hnusername);

    // And forward to success page
    res.redirect('/user/' + hnusername);
});

// This route is rendering the user profile
app.get('/user/:username', function(req, res) {
    var hnusername = req.params.username;

    // Get karma count
    client.lrange(config.app.redis.prefix + ":" + hnusername + ":karma", 0, -1, function(err, data) {
        if (!err) {
            var dataLabelsKarmaQuery = [];
            var dataKarmaQuery = [];

            var dataCommentQuery = [];
            var dataLabelsCommentQuery = [];

            var dataSubmissionQuery = [];
            var dataLabelsSubmissionQuery = [];



            for (var i = data.length - 1; i >= 0; i--) {
                var temp = data[i].split(":");

                dataKarmaQuery.push(temp[0]);
                dataLabelsKarmaQuery.push(moment.unix(temp[1]).format("MM"));
            };

            // Get comment count
            client.lrange(config.app.redis.prefix + ":" + hnusername + ":comment_count", 0, -1, function(err, data) {
                if (!err) {
                    for (var i = data.length - 1; i >= 0; i--) {
                        var temp = data[i].split(":");

                        dataCommentQuery.push(temp[0]);
                        dataLabelsCommentQuery.push(moment.unix(temp[1]).format("MM"));
                    };

                    // Get submission count
                    client.lrange(config.app.redis.prefix + ":" + hnusername + ":submission_count", 0, -1, function(err, data) {
                        if (!err) {
                            for (var i = data.length - 1; i >= 0; i--) {
                                var temp = data[i].split(":");

                                dataSubmissionQuery.push(temp[0]);
                                dataLabelsSubmissionQuery.push(moment.unix(temp[1]).format("MM"));
                            };
                        }


                        res.render('user', {
                            title: "HN Karma Tracker",
                            username: hnusername,
                            data: {
                                labelsKarma: dataLabelsKarmaQuery.reverse(),
                                dataKarma: dataKarmaQuery.reverse(),
                                labelsComment: dataLabelsCommentQuery.reverse(),
                                dataComment: dataCommentQuery.reverse(),
                                labelsSubmission: dataLabelsSubmissionQuery.reverse(),
                                dataSubmission: dataSubmissionQuery.reverse()
                            }
                        });
                    })
                }
            })
        }
    });
});


// Update all the user fields, only keep the last 30 value:timestamp pairs
function updateKey(body, fieldname, cb) {
    var timestamp = moment().unix();
    var redisKey = config.app.redis.prefix + ":" + body['username'] + ":" + fieldname;
    var redisValue = body[fieldname] + ":" + timestamp;

    client.rpush(redisKey, redisValue, function(err, res) {
        if (err) {
            return cb(err);
        }
        // Make sure we are just keeping a 30 day history
        client.llen(redisKey, function(err, res) {
            if (err)
                return cb(err);
            if (res > 30) {
                return client.lpop(redisKey, function(err, res) {
                    if (err)
                        return cb(err);
                    cb();
                })
            }
            cb();
        });
    });
}

// This function updates the various redis keys (karma, comment_count, submission_count, avg)
// if the lookup in the API is successful.
function fetchStats(hnusername) {
    hn.get("users/" + hnusername, function(err, res, body) {
        if (!err) {

            // Update all fields
            async.parallel([

                    function(callback) {
                        updateKey(body, "karma", callback);
                    },
                    function(callback) {
                        updateKey(body, "comment_count", callback);
                    },
                    function(callback) {
                        updateKey(body, "submission_count", callback);
                    },
                    function(callback) {
                        updateKey(body, "avg", callback);
                    }
                ],
                // Callback if everything was successful
                function(err, results) {
                    if (err) {
                        console.log("[Fetching] " + err)
                    } else {
                        console.log("[Fetching] " + moment().format("MM-DD-YYYY HH:MM:SS") + " Updated stats for " + hnusername)
                    }
                });
        } else {
            console.log("[Fetching] Error fetching new stats for " + hnusername + " from the API.")
        }
    });
}

// Update all values every day at midnight
new cron('0 0 0 * * *', function() {
    client.smembers(config.app.redis.prefix + "-users", function(err, users) {
        if (!err) {
            for (var i = users.length - 1; i >= 0; i--) {
                fetchStats(users[i]);
            };
        } else {
            console.log("[Redis] Error listing all users.")
        }
    })
}, null, true, "America/Los_Angeles");

// Catch Redis error messages
client.on("error", function(err) {
    console.log("[Redis] Error " + err);
});

// Start the app
http.createServer(app).listen(app.get('port'), function() {
    console.log(config.name + ' is listening on port ' + app.get('port'));
});