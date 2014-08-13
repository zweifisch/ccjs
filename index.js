var fs = require('fs');
var path = require('path');
var url = require('url');
var debug = require('debug');

var log = {
    info: debug('ccjs:info'),
    debug: debug('ccjs:debug')
};


var stripExt = function(filename) {
    return filename.substr(0, filename.length - path.extname(filename).length);
};

var readFileSync = function(filename) {
    return fs.readFileSync(filename, {encoding:'utf8'});
};

var memorize = function(fn) {
    var memorized = {};
    return function() {
        var key = Array.prototype.join.call(arguments, ',');
        log.debug('memorize ' + key);
        if (!(key in memorized)) {
            memorized[key] = fn.apply(null, arguments);
        }
        return memorized[key];
    };
};

var readFileSyncCached = memorize(readFileSync);

var getIdFromPath = function(p, root) {
    return stripExt(path.relative(root, p));
};

var getFilenames = function(m) {
    var ret = [m.filename];
    var length = m.children.length;
    for (var i = 0; i < length; i ++) {
        if (m.children[i].children) {
            ret = ret.concat(getFilenames(m.children[i]));
        } else {
            ret.push(m.children[i].filename);
        }
    }
    return ret;
};

var modulize = function(script, filename, root) {
    var id = getIdFromPath(filename, root);
    if (id.substr(0,2) !== '..' && id.substr(0,1) !== '/' && id.substr(0,2) !== './') {
        id = './' + id;
    }
    return "require.modules['"+id+"'] = function(require, exports, module) {\n"
        + script
        + "}";
};

var stripComments = function(source) {
    return source.replace(/(?:\/\*(?:[\s\S]*?)\*\/)|(?:([\s;])+\/\/(?:.*)$)/gm, '$1');
};

var scanForRequires = function(script) {
    var matched = stripComments(script).match(/require\s*\(\s*['"][^)]+['"]\s*\)/g);
    if (matched) {
        return ret = matched.map(function(x) {
            return x.match(/require\s*\(\s*['"](.*)['"]\s*\)/)[1];
        });
    }
    return [];
};

var getAllLoadedModule = function() {
    var lookup = {};
    var root = module;

    while (root.parent) root = root.parent;

    var getModuleFiles = function(m) {
        var length = m.children.length;
        for (var i=0; i<length; i++) {
            lookup[m.children[i].filename] = m.children[i];
            if (m.children[i].children) {
                getModuleFiles(m.children[i]);
            }
        }
    };
    getModuleFiles(root);

    return lookup;
};

var depsCache = {};
var getScriptDependencies = function(filename, compilers) {
    var ext = 'js';
    var mtime = null;
    try {
        mtime = +fs.statSync(filename + '.' + ext).mtime;
    } catch(e) {
        if (compilers) {
            for(ext in compilers) {
                try {
                    mtime = +fs.statSync(filename + '.' + ext).mtime;
                } catch(e) {}
            }
        }
    }
    if (!mtime) {
        throw new Error('failed to get mtime of ' + filename);
    }
    if (!(filename in depsCache && depsCache[filename].mtime == mtime)) {
        depsCache[filename] = _getScriptDependencies(filename, ext, compilers ? compilers[ext] : null);
        depsCache[filename].mtime = mtime;
    }
    return depsCache[filename];
};

var _getScriptDependencies = function(filename, ext, compiler) {
    log.debug('load ' + filename + ' as ' + ext);
    var content = readFileSync(filename + '.' + ext);
    if (compiler) content = compiler(content);
    return {
        content: content,
        requires: scanForRequires(content)
    };
};

var deps = function(filename, compilers) {
    var modules = {};
    var nodeModules = {};

    var processModule = function(filename, parent) {
        log.debug(filename + ' from ' + parent);
        var _module = getScriptDependencies(filename, compilers);
        modules[filename] = _module;
        _module.requires.filter(function(r){
            return !(r in modules);
        }).forEach(function(r){
            if (r[0] === '.') {
                processModule(path.join(path.dirname(filename), r), filename);
            } else {
                nodeModules[r] = true;
            }
        });
    };

    processModule(filename);
    
    nodeModules = Object.keys(nodeModules);
    
    nodeModules.forEach(require);
    var lookup = getAllLoadedModule();
    nodeModules = nodeModules.map(function(modulename) {
        return lookup[require.resolve(modulename)];
    }).filter(function(x) {
        return !!x;
    });
    
    var filenames = [].concat.apply([], nodeModules.map(getFilenames));
    log.debug('npm modules ', filenames);
    filenames.forEach(function(filename) {
        modules[filename] = {
            content: readFileSyncCached(filename)
        };
    });
    return modules;
};

var bundle = function(realpath, root, compilers) {
    var dependencies = deps(realpath, compilers);
    return browserify(dependencies, realpath, root);
};

var getModulename = function(p) {
    var lastIndex = p.lastIndexOf('node_modules/');
    if (lastIndex !=- -1) {
        p = p.substr(lastIndex + 13);
        return p.substr(0, p.indexOf('/'));
    }
    return null;
};

var buildIndex = function(filenames, root) {
    var ret = {};
    for(var i=0; i<filenames.length; i++) {
        var modulename = getModulename(filenames[i]);
        if (modulename) {
            ret[modulename] = getIdFromPath(filenames[i], root);
        }
    }
    return ret;
};

var browserify = function(modules, entry, root) {
    var filenames = Object.keys(modules);
    var map = buildIndex(filenames, root);
    return [";(function() {",
            "var require = (",
            require('./client'),
            ")();",
            "require.setMap(" + JSON.stringify(map) + ");",
            filenames.map(function(filename) {
                return modulize(modules[filename].content, filename, root);
            }).join("\n"),
            "require('./"+getIdFromPath(entry, root)+"');",
            "})();"].join("\n");
};

var middleware = function(opts) {
    root = opts.root || '.';
    var compilers = {};
    if (opts.coffee) {
        var coffee = require('coffee-script');
        compilers.coffee = function(js) {
            return coffee.compile(js, {bare: true});
        };
    }
    return function(req, res, next) {
        var pathname = url.parse(req.url).pathname;
        if (req.method === 'GET' && path.extname(pathname) === '.js' && req.query.commonjs) {
            var realpath = path.join(root, pathname.substr(1));
            if (path.relative(root, realpath).substr(0,2) === '..') {
                return next();
            }
            realpath = stripExt(realpath);
            try {
                bundled = bundle(realpath, root, compilers);
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                res.write(bundled);
            } catch(e) {
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                res.write('console.error("' + e.toString().replace(/"/, '\"') + '")');
            }
            res.end();
        } else {
            next();
        }
        return null;
    };
};

exports.bundle = bundle;
exports.middleware = middleware;
