var ccjs = require('ccjs').middleware;
var connect = require('connect');
var path = require('path');

var app = connect();

app.use(connect.logger())
    .use(connect.query())
    .use(ccjs({
        root: path.join(__dirname, 'js'),
        coffee: true
    }))
    .use(connect.static(__dirname));

port = process.env.PORT || 8000;
app.listen(port);

console.log("listening on port "+ port +", use PORT=<port> to change default port");
