# ccjs

client-side common js

## how does it work

* you need to bring up an ccjs server or use the middlare(described
below) inside your connect based application(e.g. express)
* the browser make a request to the server asking for a js file
* the original js file will be read from disk
* all dependencies of that file get bundled and send to browser

## limitations

* only works with packages that has little to do with node, like jquery and lodash
* `require` takes place on the server side, so dynamic require won't work

## usage

### using the middleware

see `tests/server.js`

```javascript
var path = require('path');
var ccjs = require('ccjs').middleware;

app.use(ccjs(path.join(__dirname, '/public/js')));
```

```html
<script src="main.js?commonjs=1"></script>
```

### grunt/gulp plugin

TBD
