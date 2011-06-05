var DNode = require('dnode');
var sys = require('sys');
DNode.connect(6060, function (remote) {
	var msg = {
		from: 'lordy',
		to : 'stephen',
		sub : 'test',
		body : 'Testing',
	};

	remote.sendMessage(msg, function (result) {
		sys.puts(result);
	});
});
