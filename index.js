var fs = require('fs');
var path = require('path');

var stripExt = function(filename) {
    return filename.substr(0, filename.length - path.extname(filename).length);
};

var reload = function(name) {
    filename = require.resolve(name);
    delete require.cache[filename];
    module.children = module.children.filter(function(m) {
        return m.filename !== filename;
    });
    return require(name);
};

var content = function(name) {
    filename = require.resolve(name);
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

var rewrite = function(name, root) {
    var id = getIdFromPath(name, root);
    if (id.substr(0,2) !== '..' && id.substr(0,1) !== '/' && id.substr(0,2) !== './') {
        id = './' + id;
    }
    return "require.modules['"+id+"'] = function(require, exports, module) {\n"
        + content(name)
        + "}";
};

var deps = function(script) {
    var result = script.match(/require\s*\(\s*['"]([a-zA-Z0-9/._-]+)['"]\s*\)/g);
	if (result && result.length) {
		return result.map(function(statement) {
			return statement.match(/['"]([a-zA-Z0-9./_-]+)['"]/)[1];
        });
    }
    return [];
};

var dump = function(filename, root) {
    root = root || '.';
    filename = path.join(root, filename);
    filename = stripExt(filename);
    var directDeps = deps(content(filename));

    directDeps = directDeps.map(function(m) {
        return m[0] === '.' ? path.join(root, m) : m;
    });
    
    directDeps.forEach(function(m) {
        require(m);
    });

    lookup = {};
    length = module.children.length;
    for (i=0; i<length; i++) {
        lookup[module.children[i].filename] = module.children[i];
    }
    
    var modules = directDeps.map(function(m) {
        return lookup[require.resolve(m)];
    }).filter(function(m) {
        return !!m;
    });
    
    filenames = [].concat.apply([], modules.map(getFilenames));
    filenames.unshift(filename);
    return browserify(filenames, root);
};

var clientJS = function() {

    var cache = {};
    var modules = {};
    var map = {};
    
    var getRequire = function(pwd) {
        return function(name) {
            var path = resolve(name, pwd);
            if(!(path in cache)) {
                var module = {exports:{}};
                if(!(path in modules)) {
                    console.log('modules', Object.keys(modules));
                    console.log('map', map);
                    console.log('name', name);
                    console.log('path', path);
                }
                modules[path](getRequire(dirname(path)), module.exports, module);
                cache[path] = module.exports;
            }
            return cache[path];
        };
    };

    var resolve = function(name, pwd) {
        if (name[0] === '.') {
            return join(pwd, name);
        } else {
            return map[name];
        }
    };
    
    var dirname = function(filename) {
        splited = filename.split('/');
        if (splited[splited.length - 1] === '') {
            return filename;
        } else {
            splited.pop();
            return splited.join('/');
        }
    };

    var self = function(x) {return x;};

    var join = function(p1, p2) {
        var absolute = p1.substr(0,1) === '/';
        var directory = p2.substr(p2.length - 1) === '/';
        p1 = p1.split('/').filter(self);
        p2 = p2.split('/').filter(self);
        while (p1.length && p2.length) {
            if (p2[0] === '.') {
                p2.shift();
            } else if (p2[0] === '..') {
                p2.shift();
                p1.pop();
            } else {
                break;
            }
        }
        return (absolute ? '/' : '') + p1.concat(p2).join('/') + (directory ? '/' : '');
    };
    
    require = getRequire('');
    require.modules = modules;
    require.setMap = function(m) {
        map = m;
    };
    return require;
};

var buildIndex = function(filenames, root) {
    var ret = {};
    for(var i=0; i<filenames.length; i++) {
        var matched = filenames[i].match('node_modules\/([^/]+)');
        if (matched && !ret[matched[1]]) {
            ret[matched[1]] = getIdFromPath(filenames[i], root);
        }
    }
    return ret;
};

var browserify = function(filenames, root) {
    var map = buildIndex(filenames, root);
    return [";(function() {",
            "var require = (",
            clientJS,
            ")();",
            "require.setMap(" + JSON.stringify(map) + ");",
            filenames.map(function(filename){return rewrite(filename, root);}).join("\n"),
            "require('./"+getIdFromPath(filenames[0], root)+"');",
            "})();"].join("\n");
};

var middleware = function(root) {
    root = root || '.';
    return function(req, res, next) {
        var p = req.url;
        if (p.indexOf('?')) {
            p = p.substr(0, p.indexOf('?'));
        }
        if (req.method === 'GET' && path.extname(p) === '.js' && req.query.commonjs) {
            res.writeHead(200, {
                'Content-Type': 'text/javascript'
            });
            res.write(dump(req.url.substr(1), root));
            return res.end();
        } else {
            next();
        }
    };
};

exports.dump = dump;
exports.middleware = middleware;
