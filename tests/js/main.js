
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
    
    it('should load your script', function() {
        m1 = require('./m1');
        m1.foo.should.equal('bar');
        m1.m2.foo.should.equal('baz');
        
        m2 = require('./m2');
        m2.module.should.equal('m2');
        
        // m3 = require('./m3');
    });

});

mocha.run();
