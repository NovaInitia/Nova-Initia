$ = require('jquery');

$.wait = function(time) {
  return $.Deferred(function(dfd) {
    setTimeout(dfd.resolve, time);
  });
}

$.wait(5000).then(function() {
	console.log("Hello");
});
