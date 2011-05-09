var NI = require('../config.js');
var gzip = require('gzip');
var headers = [];

var setHeaders = function(headers, res) {
    return $.Deferred(function(dfd) {
	headers['Content-Type'] = 'application/json';
        for(var k in headers) {
            res.header(k, headers[k]);
        }
        dfd.resolve();
    });
};

var preSend = function (data, res, cb) {
    return $.Deferred(function(dfd) {
        if(gzip && NI.web.response.gzip) {
		headers['Content-Encoding'] = 'gzip';
		setHeaders(headers, res)
			.then(gzip(data, function(err, gData) {
				cb(gData, res);
			}));
	} else {
		setHeaders(headers, res)
			.then(cb(data, res));
	}
        dfd.resolve();
    });
};

module.exports.sendData = function(err, res, data) {
	data = err || (data || {} );
	data = JSON.stringify(data);
	preSend(data,res,function(gData, res) {
		res.send(gData);
	});
};
