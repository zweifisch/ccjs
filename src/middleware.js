var path = require('path');
var url = require('url');
var debug = require('debug');

var bundler = require('./bundler');
var utils = require('./utils');
var getCompilers = require('./compilers');

var log = {
    error: debug('ccjs:middleware:error')
};


var middleware = function(opts) {
    var root = opts.root || '.';
    var compilers = getCompilers(opts);
    return function(req, res, next) {
        var pathname = url.parse(req.url).pathname;
        if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.commonjs) {
            var realpath = path.join(root, pathname.substr(1));
            if (path.relative(root, realpath).substr(0,2) === '..') {
                return next();
            }
            realpath = utils.stripExt(realpath);
            // res.setHeader('Content-Type', 'text/javascript');
            try {
                var bundled = bundler.bundle(realpath, root, compilers);
                res.write(bundled);
                return res.end();
            } catch(e) {
                log.error(e);
                res.write(';console.error(' + JSON.stringify(e) + ');');
                return res.end();
            }
        }
        return next();
    };
};

module.exports = middleware;
