// This module will be used to add every active
// HN user to the database, thus collecting his stats every 24h from now on.
// An active user is one submitting one or more new story in the last 30 days.

var config = require('./package.json'),
    redis = require('redis'),
    client = redis.createClient(),
    cron = require('cron').CronJob,
    request = require("request-json"),
    moment = require('moment'),
    hn = request.newClient('https://hn.algolia.com/api/v1/'),
    async = require('async');

// Setting up the timestamps so we only search for submissions in the last 24h.
var now = moment().unix();
var oneDayAgo = (moment().subtract('hours', 24)).unix();

// This API call will grab all the authors of story submissions submitted in the last 24h
// with more than 5 points. These are added to our redis db hntracker-users and hntracker-<username>
// the field created will be set to the current timestamp
new cron('0 0 * * * *', function() {
    hn.get("search_by_date?tags=story&numericFilters=created_at_i>" + oneDayAgo + ",created_at_i<" + now + ",points>5", function(err, response, body) {
        if (!err) {
            var pages = body['nbPages'];

            for (var i = 0; i < pages; i++) {
                hn.get("search_by_date?tags=story&numericFilters=created_at_i>" + oneDayAgo + ",created_at_i<" + now + ",points>5&page=" + i, function(err, response, body) {
                    if (!err) {
                        for (var i = 0; i < body['hits'].length; i++) {
                            var hnusername = body['hits'][i]['author'];
                            var timestamp = moment().unix();

                            client.exists(config.app.redis.prefix + "-" + hnusername, function(err, reply) {
                                if (!err) {
                                    // If name not in the db yet, add it and set new timestamp
                                    if (reply == 0) {
                                        client.hmset(config.app.redis.prefix + "-" + hnusername, "created", timestamp);
                                        client.sadd(config.app.redis.prefix + "-users", hnusername);
                                    }
                                }
                            });
                        }
                    } else {
                        console.log("Error fetching users to the API.")
                    }
                })
            };
        } else {
            console.log("Error fetching number of pages from the API.")
        }
    });
}, null, true, "America/Los_Angeles");