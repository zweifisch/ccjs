var fs = require('fs');
var path = require('path');
var url = require('url');

var stripExt = function(filename) {
    return filename.substr(0, filename.length - path.extname(filename).length);
};

var readFileSync = function(filename) {
    return fs.readFileSync(filename, {encoding:'utf8'});
};

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

var object = function(keys, values) {
    var len = keys.length;
    var ret = {};
    for (var i=0; i<len; i++) {
        ret[keys[i]] = values[i];
    }
    return ret;
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

var deps = function(script, filename, compilers) {

    var required = {};
    var nodeModules = {};

    var getDeps = function(requires, parent) {
        for (i=0; i<requires.length; i++) {
            var id = requires[i];
            if (id[0] === '.') {
                id = path.join(path.dirname(parent), id);
                if (!(id in required)) {
                    if (fs.existsSync(id + '.js')) {
                        required[id] = readFileSync(id + '.js');
                    } else {
                        for (var ext in compilers) {
                            if (fs.existsSync(id + '.' + ext)) {
                                required[id] = compilers[ext](readFileSync(id + '.' + ext));
                            }
                        }
                    }
                    if (id in required) {
                        getDeps(scanForRequires(required[id]), id);
                    } else {
                        throw new Error("module: " + id + " not found");
                    }
                }
            } else {
                nodeModules[id] = true;
            }
        }
    };

    getDeps(scanForRequires(script), filename);

    Object.keys(nodeModules).forEach(require);

    lookup = getAllLoadedModule();

    var modules = Object.keys(nodeModules).map(function(m) {
        return lookup[require.resolve(m)];
    }).filter(function(m) {
        return !!m;
    });

    var filenames = [].concat.apply([], modules.map(getFilenames));
    for (i=0; i<filenames.length; i++) {
        required[filenames[i]] = readFileSync(filenames[i]);
    }

    return required;
};

var processFile = function(js, filename, root, compilers) {
    var dependencies = deps(js, filename, compilers);
    dependencies[filename] = js;
    return browserify(dependencies, filename, root);
};

var getModulename = function(p) {
    var lastIndex = p.lastIndexOf('node_modules/');
    if (lastIndex !=- -1) {
        p = p.substr(lastIndex + 13);
        return p.substr(0, p.indexOf('/'));
    }
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
                return modulize(modules[filename], filename, root);
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
            
            if (opts.coffee && fs.existsSync(realpath + '.coffee')) {
                js = readFileSync(realpath + '.coffee');
                js = compilers.coffee(js);
            } else {
                js = readFileSync(realpath + '.js' , {encoding: 'utf8'});
            }

            res.writeHead(200, {
                'Content-Type': 'text/javascript'
            });
            res.write(processFile(js, realpath, root, compilers));
            res.end();
        } else {
            next();
        }
        return null;
    };
};

exports.processFile = processFile;
exports.middleware = middleware;
