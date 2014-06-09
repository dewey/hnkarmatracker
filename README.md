![alt tag](https://github.com/dewey/hnkarmatracker/tree/master/public/images/readme.jpg)

# Hackernews Karma Tracker
This is a simple webapp to track your Hackernews karma, comment count and submission count. It's written in NodeJS and using Redis to store all the collected values. There's a cronjob running every 24h to collect new stats for all registrated users. All the stats are collected using the [Algolia API](https://hn.algolia.com/api/).

# Data

#### Usernames:

All the usernames are stored in a set called `<redis-prefix>-users`. The prefix is set in the config file's app section:

    "app": {
        "title": "HN Karma Tracker",
        "redis": {
            "prefix": "hntracker"
        }
    }

Listing all users currently signed up: `smembers hntracker-users`

#### Stats:

The collected stats as listed on the HN profile (karma, submission count, comment count and avg) are stored in lists:

    <redis-prefix>:hnusername:karma
    <redis-prefix>:hnusername:submission_count
    <redis-prefix>:hnusername:comment_count
    <redis-prefix>:hnusername:avg
    
To show all list items:

`lrange <redis-prefix>:username:<fieldname> 0 -1`

# Usage

Remove the tracking JS from `layout.jade` and `public/javascripts/gauges.js`

# TODO

- Profile link to current nick for typed.js, currently hardcoded to `/user/dewey`
- Untrack form
- Hide empty graphs
- Implement better way to scrape profiles instead of Algolias API (https://news.ycombinator.com/item?id=7860385)
    
# Licence
The MIT License (MIT)

Copyright (c) 2014 dewey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.