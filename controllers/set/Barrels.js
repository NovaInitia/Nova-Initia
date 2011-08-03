module.exports = function (App) {
    return baseSet = require('../SendController')(App,
        //Write Method
        function(opts,dSend) {
            
            //Grab pageId
            var pageId = parseInt(opts.to);
            
            //Arrange properties for write to Db
            delete opts.to;
            opts.date = new Date();
            opts._id = opts.date.getTime();
            
            dSend("Pages",pageId,"barrels",opts);
        },
        //Validation Method
        function(opts) {
            return (
                typeof(opts.to) !== "undefined"
                && typeof(opts.from) !== "undefined"
                && (opts.barrels || opts.traps || opts.spiders || opts.shields || opts.doorways || opts.signposts || opts.sg)
            );
        });
};