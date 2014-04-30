
module.exports = function() {

    var cache = {};
    var modules = {};
    var map = {};
    var process = {
        env:{}
    };

    var f = function(){};
    var shims = {
        tty: {
            isatty: f
        }
    };
    
    var getRequire = function(pwd) {
        return function(name) {
            var path = resolve(name, pwd);
            if (!(path in cache)) {
                var module = {exports:{}};
                if (!(path in modules)) {
                    if (name in shims) {
                        return shims[name];
                    }
                    console.log('modules', Object.keys(modules));
                    console.log('map', map);
                    console.log('name', name);
                    console.log('path', path);
                }
                modules[path](getRequire(dirname(path)), module.exports, module, process);
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
