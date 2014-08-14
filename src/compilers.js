module.exports = function(compilers) {
    ret = {};
    if (compilers.coffee) {
        var coffee = require('coffee-script');
        ret.coffee = function(js) {
            return coffee.compile(js, {bare: true});
        };
    }
    return ret;
};
