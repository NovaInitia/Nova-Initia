var isCompressed = false;

if(isCompressed) {
	var gzip = require('gzip');
}

module.exports.sendData = function(res, data) {
	//console.log(data);
	if(isCompressed) {
		gzip(data, function(err, gData) {
			res.header('Content-Encoding','gzip');
			res.send(gData);
		});
	} else {
		res.send(data);
	}
};
