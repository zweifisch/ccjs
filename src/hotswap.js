var fs = require('fs');
var url = require('url');
var path = require('path');
var debug  = require('debug');
var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');
var bundler = require('./bundler');
var getCompilers = require('./compilers');

var log = {
    info: debug('ccjs:hotswap:info'),
    debug: debug('ccjs:hotswap:debug')
};


module.exports = function(opts) {

    var emitter = new EventEmitter();
    fs.watch(opts.root, function(event, filename) {
        if (event === 'change') {
            filename = utils.stripExt(filename);
            log.info(filename + ' changed');
            emitter.emit('changed', filename);
        }
    });
    
    log.info('ccjs start watch in ' + opts.root);
    var compilers = getCompilers(opts);
    
    return function(req, res, next) {
        var pathname = url.parse(req.url).pathname;
        if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.commonjs) {
            log.debug(pathname + ' seed');
            res.write(["(" , require('./hotswap-client'), ")();"].join('\n'));
        } else if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.event) {
            log.debug(pathname + ' subscribed');
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            emitter.on('changed', function(filename) {
                var bundled = bundler.bundleModule(path.join(opts.root, filename), opts.root, compilers);
                res.write('event: swap\n');
                res.write('data: ' + bundled.split('\n').join(''));
                res.write('\n\n');
            });
            return null;
        }
        return next();
    };
};
