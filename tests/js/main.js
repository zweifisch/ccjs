chai.should();
mocha.setup('bdd');

describe('require', function() {

    it('should load lodash', function() {
        _ = require('lodash');
        (typeof _.map).should.equal('function');
    });

    it('should load jquery', function() {
        $ = require('jquery');
        (typeof $.fn.jquery).should.equal('string');
    });

    it('should load user script', function() {
        m1 = require('./m1');
        m1.foo.should.equal('bar');
        m1.m2.foo.should.equal('baz');

        m2 = require('./m2');
        m2.module.should.equal('m2');
    });

    it('should handle mutiple require on sameline', function() {
        m1 = require('./m1'); m2 = require('./m2');
        m1.foo.should.equal('bar');
        m1.m2.foo.should.equal('baz');
        m2.module.should.equal('m2');
    });

    it('should ignore comments', function() {
        // require('./notexists');
        /*
         * require('./notexists');
         */
    });

    it('should load component', function() {
        page = require('page');
        (typeof page).should.equal('function');
    });

    it('should load coffee scripts', function() {
        m4 = require('./m4');
        m4().should.equal('coffee please!');
    });

    it('should load modules already required server side', function() {
        tooLate = require('too-late');
        (typeof tooLate).should.equal('function');
    });

});

if (window.mochaPhantomJS) {
    mochaPhantomJS.run();
} else {
    mocha.run();
}
