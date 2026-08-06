//JSON-backed stand-in for Mongoose, so the game can be exercised without MongoDB.
//Implements the slice of the Mongoose API that models/ and app.js actually use.

var fs = require('fs');
var path = require('path');

var FIXTURE_DIR = path.join(__dirname, '..', 'test', 'fixtures');

//'User' -> 'users', 'Class' -> 'classes'
var collectionFor = function (name) {
    var lower = name.toLowerCase();
    if (/(s|x|z|ch|sh)$/.test(lower)) {
        return lower + 'es';
    }
    return lower + 's';
};

//Walks a dotted path so queries can reach into 'stats.exp.giver'.
var valueAt = function (doc, dotted) {
    var parts = dotted.split('.');
    var cur = doc;
    for (var i = 0; i < parts.length; ++i) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = cur[parts[i]];
    }
    return cur;
};

var setAt = function (doc, dotted, val) {
    var parts = dotted.split('.');
    var cur = doc;
    for (var i = 0; i < parts.length - 1; ++i) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
            cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
};

var equals = function (a, b) {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return equals(a[k], b[k]); });
};

//The query operators this codebase uses, in app.js and controllers/.
var matchOperators = function (actual, ops) {
    return Object.keys(ops).every(function (op) {
        var expected = ops[op];
        switch (op) {
            case '$gt':  return actual > expected;
            case '$gte': return actual >= expected;
            case '$lt':  return actual < expected;
            case '$lte': return actual <= expected;
            case '$ne':  return !equals(actual, expected);
            case '$in':  return Array.isArray(expected) && expected.some(function (e) { return equals(actual, e); });
            case '$not': return !matchValue(actual, expected);
            case '$elemMatch':
                return Array.isArray(actual) && actual.some(function (el) { return matchQuery(el, expected); });
            default:
                throw new Error('jsonstore: unsupported query operator ' + op);
        }
    });
};

var isOperatorObject = function (val) {
    return val !== null
        && typeof val === 'object'
        && !Array.isArray(val)
        && !(val instanceof Date)
        && Object.keys(val).length > 0
        && Object.keys(val).every(function (k) { return k.charAt(0) === '$'; });
};

var matchValue = function (actual, expected) {
    if (isOperatorObject(expected)) return matchOperators(actual, expected);
    //Mongo semantics: matching a scalar against an array field matches any element.
    if (Array.isArray(actual) && !Array.isArray(expected)) {
        return actual.some(function (el) { return equals(el, expected); });
    }
    return equals(actual, expected);
};

var matchQuery = function (doc, query) {
    return Object.keys(query || {}).every(function (key) {
        return matchValue(valueAt(doc, key), query[key]);
    });
};

var applyUpdate = function (doc, update) {
    Object.keys(update).forEach(function (op) {
        var clause = update[op];
        switch (op) {
            case '$set':
                Object.keys(clause).forEach(function (f) { setAt(doc, f, clause[f]); });
                break;
            case '$inc':
                Object.keys(clause).forEach(function (f) {
                    setAt(doc, f, (valueAt(doc, f) || 0) + clause[f]);
                });
                break;
            case '$addToSet':
                Object.keys(clause).forEach(function (f) {
                    var arr = valueAt(doc, f);
                    if (!Array.isArray(arr)) { arr = []; setAt(doc, f, arr); }
                    var exists = arr.some(function (el) { return equals(el, clause[f]); });
                    if (!exists) arr.push(clause[f]);
                });
                break;
            case '$pull':
                Object.keys(clause).forEach(function (f) {
                    var arr = valueAt(doc, f);
                    if (!Array.isArray(arr)) return;
                    var spec = clause[f];
                    //Mongo treats a plain object here as a partial match, not an exact one,
                    //so {_id: 'wanderer'} pulls {_id: 'wanderer', date: ...}.
                    var isPartial = spec !== null
                        && typeof spec === 'object'
                        && !Array.isArray(spec)
                        && !(spec instanceof Date)
                        && !isOperatorObject(spec);
                    setAt(doc, f, arr.filter(function (el) {
                        return isPartial ? !matchQuery(el, spec) : !matchValue(el, spec);
                    }));
                });
                break;
            default:
                if (op.charAt(0) === '$') throw new Error('jsonstore: unsupported update operator ' + op);
                setAt(doc, op, clause);
        }
    });
    return doc;
};

var clone = function (obj) {
    return obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
};

//Mongoose casts query values to the type declared in the schema, which is what lets
//findOne({_id: req.params.id}) match a numeric _id. Fixtures hold dates as ISO strings,
//so Date values cast to strings for matching and hydrate back to Dates on read.
var castValue = function (type, val) {
    if (val === null || val === undefined) return val;
    if (type === Number) {
        var n = (typeof val === 'number') ? val : Number(val);
        return isNaN(n) ? val : n;
    }
    if (type === String) return (typeof val === 'string') ? val : String(val);
    if (type === Boolean) {
        if (typeof val === 'boolean') return val;
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
    }
    if (type === Date) return (val instanceof Date) ? val.toISOString() : val;
    return val;
};

var castQuery = function (definition, query) {
    if (!query || typeof query !== 'object') return query;
    var out = {};
    Object.keys(query).forEach(function (key) {
        var type = definition[key];
        var val = query[key];
        if (isOperatorObject(val)) {
            var ops = {};
            Object.keys(val).forEach(function (op) {
                ops[op] = (op === '$in' && Array.isArray(val[op]))
                    ? val[op].map(function (v) { return castValue(type, v); })
                    : castValue(type, val[op]);
            });
            out[key] = ops;
        } else {
            out[key] = castValue(type, val);
        }
    });
    return out;
};

//---------------------------------------------------------------------------
// Schema
//---------------------------------------------------------------------------

var Schema = function (definition) {
    this.definition = definition || {};
    this.virtuals = {};
};

Schema.prototype.virtual = function (name) {
    var schema = this;
    if (!schema.virtuals[name]) schema.virtuals[name] = {};
    return {
        set: function (fn) { schema.virtuals[name].setter = fn; return this; },
        get: function (fn) { schema.virtuals[name].getter = fn; return this; }
    };
};

Schema.ObjectId = 'ObjectId';
Schema.Email = 'Email';

//---------------------------------------------------------------------------
// Store
//---------------------------------------------------------------------------

var Store = function (fixtureDir) {
    this.fixtureDir = fixtureDir || FIXTURE_DIR;
    this.data = {};          //collection name -> array of plain documents
    this.schemas = {};       //model name -> Schema
    this.compiled = {};      //model name -> Model constructor
    this.models = { base: {} };
    this.Schema = Schema;
    this.SchemaTypes = { Email: 'Email', ObjectId: 'ObjectId' };
    this.connection = { readyState: 0 };
};

//Mongoose's connect() signature, but it loads JSON fixtures from disk instead.
Store.prototype.connect = function (uri) {
    this.load();
    this.connection.readyState = 1;
    return this;
};

Store.prototype.load = function () {
    var self = this;
    self.data = {};
    if (!fs.existsSync(self.fixtureDir)) return self;
    fs.readdirSync(self.fixtureDir)
        .filter(function (f) { return /\.json$/.test(f); })
        .forEach(function (f) {
            var name = path.basename(f, '.json');
            var raw = fs.readFileSync(path.join(self.fixtureDir, f), 'utf8');
            try {
                self.data[name] = JSON.parse(raw);
            } catch (e) {
                throw new Error('jsonstore: ' + f + ' is not valid JSON — ' + e.message);
            }
        });
    return self;
};

//Discards all mutations and re-reads the fixtures. Test isolation depends on this.
Store.prototype.reset = function () {
    return this.load();
};

Store.prototype.collection = function (name) {
    if (!this.data[name]) this.data[name] = [];
    return this.data[name];
};

//Writes current in-memory state back to the fixture files. Off by default.
Store.prototype.flush = function () {
    var self = this;
    Object.keys(self.data).forEach(function (name) {
        fs.writeFileSync(
            path.join(self.fixtureDir, name + '.json'),
            JSON.stringify(self.data[name], null, 2) + '\n'
        );
    });
};

Store.prototype.model = function (name, schema) {
    if (!schema) {
        if (!this.compiled[name]) throw new Error('jsonstore: model ' + name + ' is not registered');
        return this.compiled[name];
    }
    this.schemas[name] = schema;
    this.compiled[name] = buildModel(this, name, schema);
    return this.compiled[name];
};

//---------------------------------------------------------------------------
// Model + Document
//---------------------------------------------------------------------------

var buildModel = function (store, name, schema) {
    var collectionName = collectionFor(name);

    var Model = function (doc) {
        var self = this;
        var source = (doc && typeof doc.toObject === 'function') ? doc.toObject() : (doc || {});
        Object.keys(source).forEach(function (k) { self[k] = clone(source[k]); });
    };

    Model.modelName = name;
    Model.collectionName = collectionName;
    Model.schema = schema;
    Model.store = store;

    Model.prototype.toObject = function () {
        var plain = {};
        var self = this;
        Object.keys(self).forEach(function (k) {
            if (typeof self[k] !== 'function') plain[k] = self[k];
        });
        return plain;
    };

    Model.prototype.toJSON = Model.prototype.toObject;

    //Mongoose routes doc.set(path, val) through a virtual's setter when one is registered.
    Model.prototype.set = function (field, value) {
        var virtual = schema.virtuals[field];
        if (virtual && virtual.setter) {
            virtual.setter.call(this, value);
            return this;
        }
        setAt(this, field, value);
        return this;
    };

    Model.prototype.get = function (field) {
        var virtual = schema.virtuals[field];
        if (virtual && virtual.getter) return virtual.getter.call(this);
        return valueAt(this, field);
    };

    Model.prototype.save = function (cb) {
        var rows = store.collection(collectionName);
        var plain = clone(this.toObject());
        var idx = -1;
        for (var i = 0; i < rows.length; ++i) {
            if (equals(rows[i]._id, plain._id)) { idx = i; break; }
        }
        if (idx > -1) rows[idx] = plain; else rows.push(plain);
        if (cb) process.nextTick(function () { cb(null, plain); });
        return this;
    };

    Model.prototype.remove = function (cb) {
        var rows = store.collection(collectionName);
        var plain = this.toObject();
        for (var i = 0; i < rows.length; ++i) {
            if (equals(rows[i]._id, plain._id)) { rows.splice(i, 1); break; }
        }
        if (cb) process.nextTick(function () { cb(null); });
        return this;
    };

    var cast = function (query) { return castQuery(schema.definition, query || {}); };

    var hydrate = function (plain) {
        if (plain === undefined || plain === null) return plain;
        var doc = new Model(plain);
        //Declared Date paths come back as Date objects, as Mongoose would return them.
        Object.keys(schema.definition).forEach(function (field) {
            if (schema.definition[field] === Date && typeof doc[field] === 'string') {
                doc[field] = new Date(doc[field]);
            }
        });
        return doc;
    };

    Model.find = function (query, cb) {
        var q = cast(query);
        var found = store.collection(collectionName)
            .filter(function (row) { return matchQuery(row, q); })
            .map(hydrate);
        if (cb) process.nextTick(function () { cb(null, found); });
        return found;
    };

    Model.findOne = function (query, cb) {
        var q = cast(query);
        var row = store.collection(collectionName).filter(function (r) { return matchQuery(r, q); })[0];
        //Mongoose reports a miss as null, on both the callback and the return.
        var doc = (row === undefined) ? null : hydrate(row);
        if (cb) process.nextTick(function () { cb(null, doc); });
        return doc;
    };

    Model.findById = function (id, cb) {
        return Model.findOne({ _id: id }, cb);
    };

    Model.count = function (query, cb) {
        var q = cast(query);
        var n = store.collection(collectionName).filter(function (r) { return matchQuery(r, q); }).length;
        if (cb) process.nextTick(function () { cb(null, n); });
        return n;
    };

    Model.update = function (query, update, cb) {
        var q = cast(query);
        var touched = 0;
        store.collection(collectionName).forEach(function (row) {
            if (matchQuery(row, q)) { applyUpdate(row, update); ++touched; }
        });
        if (cb) process.nextTick(function () { cb(null, touched); });
        return touched;
    };

    //The atomic read-modify-write the controllers/ layer is built around.
    Model.findAndModify = function (query, sort, update, options, cb) {
        var rows = store.collection(collectionName);
        var opts = options || {};
        var q = cast(query);
        var target = null;
        for (var i = 0; i < rows.length; ++i) {
            if (matchQuery(rows[i], q)) { target = rows[i]; break; }
        }
        if (!target && opts.upsert) {
            target = {};
            Object.keys(q).forEach(function (k) {
                if (!isOperatorObject(q[k]) && k.charAt(0) !== '$') setAt(target, k, q[k]);
            });
            rows.push(target);
        }
        if (!target) {
            var err = new Error('No matching object found');
            if (cb) process.nextTick(function () { cb(err, null); });
            return null;
        }
        var before = clone(target);
        applyUpdate(target, update);
        var result = opts['new'] === false ? before : clone(target);
        if (cb) process.nextTick(function () { cb(null, result); });
        return result;
    };

    Model.remove = function (query, cb) {
        var rows = store.collection(collectionName);
        var q = cast(query);
        var kept = rows.filter(function (r) { return !matchQuery(r, q); });
        var removed = rows.length - kept.length;
        store.data[collectionName] = kept;
        if (cb) process.nextTick(function () { cb(null, removed); });
        return removed;
    };

    return Model;
};

//---------------------------------------------------------------------------

module.exports = function (fixtureDir) {
    return new Store(fixtureDir);
};

module.exports.Schema = Schema;
module.exports.Store = Store;
module.exports.internals = {
    matchQuery: matchQuery,
    applyUpdate: applyUpdate,
    collectionFor: collectionFor
};
