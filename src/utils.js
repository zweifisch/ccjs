fs = require('fs');
path = require('path');

exports.stripExt = function(filename) {
    return filename.substr(0, filename.length - path.extname(filename).length);
};

exports.readFileSync = function(filename) {
    return fs.readFileSync(filename, {encoding:'utf8'});
};

exports.memorize = function(fn) {
    var memorized = {};
    return function() {
        var key = Array.prototype.join.call(arguments, ',');
        if (!(key in memorized)) {
            memorized[key] = fn.apply(null, arguments);
        }
        return memorized[key];
    };
};
