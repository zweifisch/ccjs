var url = require('url');
var path = require('path');
var debug  = require('debug');
var chokidar = require('chokidar');

var utils = require('./utils');
var bundler = require('./bundler');
var getCompilers = require('./compilers');

var log = {
    info: debug('ccjs:hotswap:info'),
    debug: debug('ccjs:hotswap:debug')
};


module.exports = function(opts) {

    var watcher = chokidar.watch(opts.root, {ignored: /[\/\\]\./});

    log.info('ccjs start watch in ' + opts.root);
    var compilers = getCompilers(opts);
    
    return function(req, res, next) {
        var pathname = url.parse(req.originalUrl || req.url).pathname;
        if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.commonjs) {
            log.debug(pathname + ' seed');
            res.write(require('./hotswap-client')(pathname));
        } else if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.event) {
            log.debug(pathname + ' subscribed');
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            
            watcher.on('change', function(filename) {
                filename = utils.stripExt(filename);
                log.info(filename + ' changed');
                var bundled = bundler.bundleModule(filename, opts.root, compilers);
                res.write('event: swap\n');
                res.write('data: ' + bundled.split('\n').join(''));
                res.write('\n\n');
            });
            return null;
        }
        return next();
    };
};
