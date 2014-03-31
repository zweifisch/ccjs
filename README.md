# ccjs

client-side common js

## limitations

* only works with packages that has little to do with node, like jquery and lodash
* `require` takes place on the server side, so dynamic require won't work

## using the middleware

```javascript
var path = require('path');
var ccjs = require('ccjs').middleware;

app.use(ccjs(path.join(__dirname, '/public/js')));
```

```html
<script src="main.js?commonjs=1"></script>
```

## grunt/gulp plugin

TBD
