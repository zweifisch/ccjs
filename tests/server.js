var path = require('path');
var express = require('express');
var ccjs = require('../index');

require('too-late');

var app = express();

var options = {
    root: path.join(__dirname, 'js'),
    coffee: true
};

app.use(ccjs.middleware(options));

app.use(express.static(__dirname));


port = process.env.PORT || 8000;
app.listen(port);

console.log("listening on port "+ port +", use PORT=<port> to change default port");
