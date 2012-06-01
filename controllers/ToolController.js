module.exports = function (App) {    
        var db = App.Data;
        
        // constructor
        var cls = function (collection) {
            
            // private
            collection = collection || "Tools";
            
            db.bind(collection);
        
            this.findItems = function(query, cb) {
                    db[collection].findItems(query, cb);
            };
            
            this.findOne = db[collection].findOne;
            
            return this;
        };
        
        // public static
        cls.get_nextId = function () {
            return nextId;
        };
        
        return cls;
};
