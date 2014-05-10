/**
 * This is a Hacker News Karma tracker because http://hn-karma-tracker.herokuapp.com/ isn't working for me. (Invalid Username)
 */

var express = require('express'),
    http = require('http'),
    redis = require("redis"),
    client = redis.createClient(),
    request = require("request-json"),
    hn = request.newClient('https://hn.algolia.com/api/v1/'),
    moment = require('moment'),
    cron = require('cron').CronJob,
    path = require('path');

var app = express();

// Prefix we are using to make it easier to identify redis keys related to this project.
var redisPrefix = "hntracker"

// Setting up Express
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
    app.locals.pretty = true;
}

app.get('/', function(req, res) {
    res.render('index', {
        title: "HN Karma Tracker"
    });
});

app.get('/user/signup', function(req, res) {
    res.render('signup', {
        title: "HN Karma Tracker"
    });
});

app.post('/user/add', function(req, res) {
    // TODO: Sanitize input
    var hnusername = req.body.hnusername;
    var timestamp = moment().unix();

    if (hnusername.length > 1 && hnusername.length < 50) {

        // Check if user is already in the database
        client.exists(redisPrefix + "-" + hnusername, function(err, reply) {
            if (!err) {
                if (reply == 1) {
                    console.log("[HN Tracker] User already exists. Redirecting to user page.")

                    // Fetching new stats
                    updateUser(hnusername)

                    // Overwrite URL
                    res.location('/user/' + hnusername);

                    // And forward to success page
                    res.redirect('/user/' + hnusername);
                } else {
                    console.log("[HN Tracker] Adding new user")
                    client.hmset(redisPrefix + "-" + hnusername, "created", timestamp);

                    // Fetching new stats
                    updateUser(hnusername)

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
        console.log("[HN Tracker] Error: Not a valid username.")
    }
});


app.get('/user/:username/refresh', function(req, res) {
    var hnusername = req.params.username;
    updateUser(hnusername);

    // Overwrite URL
    res.location('/user/' + hnusername);

    // And forward to success page
    res.redirect('/user/' + hnusername);
});

app.get('/user/:username', function(req, res) {
    var hnusername = req.params.username;

    // Get karma count
    client.lrange(redisPrefix + ":" + hnusername + ":karma", 0, -1, function(err, data) {
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
            client.lrange(redisPrefix + ":" + hnusername + ":comment_count", 0, -1, function(err, data) {
                if (!err) {
                    for (var i = data.length - 1; i >= 0; i--) {
                        var temp = data[i].split(":");

                        dataCommentQuery.push(temp[0]);
                        dataLabelsCommentQuery.push(moment.unix(temp[1]).format("MM"));
                    };

                    // Get submission count
                    client.lrange(redisPrefix + ":" + hnusername + ":submission_count", 0, -1, function(err, data) {
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
                                labelsKarma: dataLabelsKarmaQuery,
                                dataKarma: dataKarmaQuery,
                                labelsComment: dataLabelsCommentQuery,
                                dataComment: dataCommentQuery,
                                labelsSubmission: dataLabelsSubmissionQuery,
                                dataSubmission: dataLabelsSubmissionQuery
                            }
                        });
                    })
                }
            })
        }
    });
});


// Update all the user fields, only keep the last 30 value:timestamp pairs
function updateKey(body, fieldname, hnusername) {
    var timestamp = moment().unix();
    var redisKey = redisPrefix + ":" + hnusername + ":" + fieldname;
    var redisValue = body[fieldname] + ":" + timestamp;

    client.rpush(redisKey, redisValue, function(err, res) {
        if (err) {
            console.log(err)
        } else {
            // Make sure we are just keeping a 30 day history
            client.llen(redisKey, function(err, res) {
                if (res > 30) {
                    client.lpop(redisKey, function(err, res) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log("Purged from " + redisKey + " -> " + res);
                        }
                    })
                }
            });
        }
    });
}

// Update user stats
// TODO: Make async.series
function updateUser(hnusername) {
    hn.get("users/" + hnusername, function(err, res, body) {

        // Update counts
        updateKey(body, "karma", hnusername);
        updateKey(body, "comment_count", hnusername);
        updateKey(body, "submission_count", hnusername);
        updateKey(body, "avg", hnusername);
    });
}

// Update all values every day at midnight
new CronJob('0 0 0 * * *', function() {

}, null, true, "America/San_Francisco");

// Catch Redis error messages
client.on("error", function(err) {
    console.log("[Redis] Error " + err);
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});