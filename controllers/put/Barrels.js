var controller = require('../BaseController');
var UserHelper = require("../UserHelper");
module.exports = function (App) {
    var collection = "Pages";
    var property = "barrels";
    var returnProp = "page";
    
    return controller(App,
        //Write Method
        function(obj,dWrite) {
            
            //Grab pageId
            var pageId = parseInt(obj.to);
            
            //Arrange properties for write to Db
            delete obj.to;
            obj.date = new Date();
            obj._id = obj.date.getTime();
            
            var updateObj = {};
            updateObj[property] = obj;
            dWrite(
                collection,
                {_id: pageId },
                { $addToSet : updateObj },
                returnProp
            );
        },
        //Validation Method
        {
            before : function(obj, cb) {
                        var valid = (
                            typeof(obj.to) !== "undefined"
                            && typeof(obj.from) !== "undefined"
                            && (obj.barrels || obj.traps || obj.spiders || obj.shields || obj.doorways || obj.signposts || obj.sg)
                        );
                        if(valid) {
                            UserHelper(App,
                                {
                                    _id: obj.from,
                                    barrels : { "$gt" : ( parseInt(obj.barrels,10) || 0) },
                                    traps : { "$gte" : (parseInt(obj.traps,10) || 0 ) },
                                    spiders : { "$gte" : (parseInt(obj.spiders,10) || 0 ) },
                                    shields : { "$gte" : (parseInt(obj.shields,10) || 0 ) },
                                    doorways : { "$gte" : (parseInt(obj.doorways,10) || 0 ) },
                                    signposts : { "$gte" : (parseInt(obj.signposts,10) || 0 ) },
                                    sg : { "$gte" : (parseInt(obj.sg,10) || 0 ) }
                                },
                                {
                                    $inc : {
                                        barrels : ( -1 * ( parseInt(obj.barrels,10) || 0) ),
                                        traps : ( -1 * ( parseInt(obj.traps,10) || 0 ) ),
                                        spiders : ( -1 * ( parseInt(obj.spiders,10) || 0 ) ),
                                        shields : ( -1 * ( parseInt(obj.shields,10) || 0 ) ),
                                        doorways : ( -1 * ( parseInt(obj.doorways,10) || 0 ) ),
                                        signposts : ( -1 * ( parseInt(obj.signposts,10) || 0 ) ),
                                        sg : ( -1 * ( parseInt(obj.sg,10) || 0 ) )
                                    }
                                },
                                cb
                            );
                        } else {
                            cb({ error : "invalid_params" });
                        }
            },
            after : function(obj) {
            }
        }
    );
};