var UrlModel = require("../models/urlModel");
var redis = require("redis");
var lexicon = require("emoji-lexicon");
var lruMap = require("../services/lruMap");
var cachedMap = require("../services/cachedMap");
var host = process.env.REDIS_PORT_6379_TCP_ADDR;
var port = process.env.REDIS_PORT_6379_TCP_PORT;

var redisClient = redis.createClient(port, host);

var encode = [];
var genCharArray = function (charA, charZ) {
    var arr = [];
    var i = charA.charCodeAt(0);
    var j = charZ.charCodeAt(0);

    for (; i <= j; i++) {
        arr.push(String.fromCharCode(i));
    }
    return arr;
};

encode = encode.concat(genCharArray("A", "Z"));
encode = encode.concat(genCharArray("a", "z"));
encode = encode.concat(genCharArray("0", "9"));

var getShortUrl = function (username, longUrl, callback) {
    if ( longUrl.indexOf("http") === -1) {
        longUrl = "http://" + longUrl;
    }

    redisClient.get(username + ":" + longUrl, function (err, shortUrl) {
        if (shortUrl) {
            console.log("Byebye mongo!");
            callback({
                shortUrl: shortUrl,
                longUrl: longUrl,
                username: username
            });
        } else {
            UrlModel.findOne({username: username, longUrl: longUrl}, function (err, data) {
                if (data) {
                    callback(data);
                    redisClient.set(data.shortUrl, data.longUrl);
                    redisClient.set(username + ":" + data.longUrl, data.shortUrl);
                } else {
                    generateShortUrl(function (shortUrl) {
                        var url = new UrlModel({
                            shortUrl: shortUrl,
                            longUrl: longUrl,
                            username: username,
                            creationTime: new Date()
                        });
                        url.save();
                        redisClient.set(shortUrl, longUrl);
                        redisClient.set(username + ":" + longUrl, shortUrl);
                        callback(url);
                    });
                }
            });
        }
    });
};

var generateShortUrl = function (callback) {

    callback(convertToEmoji());

};

var convertToEmoji = function () {
    do {
        var result = "";
        for (var x = 0; x < 6; x++) {
            result += lexicon[Math.floor(Math.random() * lexicon.length)];
        }
    } while (cachedMap.map.has(result));

    return result;

};

var getLongUrl = function (shortUrl, callback) {
    console.log("need a longUrl from shortUrl " + shortUrl);
    var longUrlNode = lruMap.LRUCacheGet(shortUrl);
    if (longUrlNode != 'undefined') {
        console.log('Url is cached');
        console.log('short Url is  ' + longUrlNode.shortUrl + "long Url is " + longUrlNode.longUrl);
        callback({
            shortUrl: longUrlNode.key,
            longUrl: longUrlNode.value
        });
    } else {
        console.log('Mongo is called');
        UrlModel.findOne({shortUrl: shortUrl}, function (err, data) {
            callback(data);
            if (data) {
                lruMap.LRUCacheSet(data.shortUrl, data.longUrl);
                lruMap.LRUCacheSet(data.longUrl, data.shortUrl);
            }
        })
    }
};

var getMyUrls = function (username, callback) {
    UrlModel.find({username: username}, function (err, urls) {
        callback(urls);
    })
};

module.exports = {
    getShortUrl: getShortUrl,
    getLongUrl: getLongUrl,
    getMyUrls: getMyUrls
};