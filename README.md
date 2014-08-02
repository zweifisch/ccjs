# ccjs

client-side common js

## how does it work

* it will be used as a middlare(described below) inside your connect based
    application(e.g. express)
* when the browser make a request to the server asking for a js file, the
    original js file will be read from disk, and all dependencies of that file
    get bundled and sent to browser
* for performance consideration, the js file need to be pre-bundled for
    deployment, this can be done using
    [grunt-ccjs](https://github.com/zweifisch/grunt-ccjs)

## limitations

* only works with packages that has little to do with node, like jquery and lodash
* `require` takes place on the server side, so dynamic require won't work

## usage

### using the middleware

see `tests/server.js`

```javascript
var path = require('path');
var ccjs = require('ccjs').middleware;

app.use(ccjs({root:path.join(__dirname, '/public/js')}));
```

```html
<script src="main.js?commonjs=1"></script>
```

### coffeescript

```sh
npm install --save coffee-script
```

```coffee
app.use ccjs
	root: path.join __dirname, '/public/js'
	coffee: on
```

### grunt plugin

* [grunt-ccjs](https://github.com/zweifisch/grunt-ccjs)
