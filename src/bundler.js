var fs = require('fs');
var path = require('path');
var url = require('url');
var debug = require('debug');

var utils = require('./utils');

var stripExt = utils.stripExt;
var readFileSync = utils.readFileSync;

var log = {
    info: debug('ccjs:bundler:info'),
    debug: debug('ccjs:bundler:debug')
};


var readFileSyncCached = utils.memorize(readFileSync);

var getIdFromPath = function(p, root) {
    return stripExt(path.relative(root, p));
};

var getFilenames = function(m) {
    var ret = [m.filename];
    m.children.forEach(function(child) {
        if (child.children) {
            ret = ret.concat(getFilenames(child));
        } else {
            ret.push(child.filename);
        }
    });
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
        m.children.forEach(function(child) {
            lookup[child.filename] = child;
            if (child.children) {
                getModuleFiles(child);
            }
        });
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

var getDependencies = function(filename, compilers) {
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
    filenames.forEach(function(filename){
        var modulename = getModulename(filename);
        if (modulename) {
            ret[modulename] = getIdFromPath(filename, root);
        }
    });
    return ret;
};

var browserify = function(modules, root, entry) {
    var filenames = Object.keys(modules);
    var map = buildIndex(filenames, root);
    var lines = [";(function() {"];
    if (entry) {
        lines = lines.concat([
            "var require = window._ccjs_require = (",
            require('./client'),
            ")();"]);
    } else {
        lines.push("var require = window._ccjs_require;");
    }
    lines = lines.concat([
        "require.setMap(" + JSON.stringify(map) + ");",
        filenames.map(function(filename) {
            return modulize(modules[filename].content, filename, root);
        }).join("\n")]);
                 
    if (entry) {
        lines.push("require('./"+getIdFromPath(entry, root)+"');");
    }
    lines.push("})();");
    return lines.join("\n");
};

var bundle = function(realpath, root, compilers) {
    var dependencies = getDependencies(realpath, compilers);
    return browserify(dependencies, root, realpath);
};

var bundleModule = function(realpath, root, compilers) {
    var dependencies = getDependencies(realpath, compilers);
    return browserify(dependencies, root);
};

exports.bundle = bundle;
exports.bundleModule = bundleModule;
