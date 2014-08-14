module.exports = function() {

    var scripts = document.getElementsByTagName('script');
    var src = scripts[scripts.length - 1].src;
    src = src.substr(0, src.indexOf('?'));
    
    var injectJS = function(content) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.text = content;
        var head = document.getElementsByTagName('head')[0];
        head.appendChild(script);
    };

    var subscribe = function(url) {
        var source = new EventSource(url);

        source.addEventListener('swap', function(e) {
            injectJS(e.data);
        }, false);

    };
    
    subscribe(src + '?event=1');
};
