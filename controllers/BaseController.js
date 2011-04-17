var NI = require('../config.js');
var gzip = NI.web.response.gzip ? require('gzip') : NI.through;
var $ = require('jquery');
var headers = [];

var setHeaders = function(headers, res) {
    return $.Deferred(function(dfd) {
        for(var k in headers) {
            res.header(k, headers[k]);
        }
        dfd.resolve();
    });
};

var preSend = function (data, res, cb) {
    return $.Deferred(function(dfd) {
        if(gzip)
            headers['Content-Encoding'] = 'gzip';
        setHeaders(headers, res)
            .then(gzip(data, function(err, gData) {
                                cb(gData, res);
            }));
        dfd.resolve();
    });
};

module.exports.sendData = function(res, data) {
    
    preSend(data,res,function(gData, res) {
                        res.send(gData);
    });
};
