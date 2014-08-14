module.exports = function(src) {
    
    var fn = function(url) {

        var injectJS = function(content) {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.text = content;
            var head = document.getElementsByTagName('head')[0];
            head.appendChild(script);
        };

        var source = new EventSource(url);

        source.addEventListener('swap', function(e) {
            injectJS(e.data);
        }, false);
    };
    
    return ';(' + fn.toString() + ')("' + src + '?event=1' + '");';
};
