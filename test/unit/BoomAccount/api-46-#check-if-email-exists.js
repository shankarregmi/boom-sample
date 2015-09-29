/**
 * Tests:
 *     Check if email already registerd
 */
var chai = require('chai');
var expect = chai.expect;
var app = require('../../../server/server.js');
var Authenticate = app.models.Authenticate
var registeredEmail = {"email": "carolyn@aol.com"};
var unregisteredEmail = {"email": "shankarregmi@gmail.com"};

describe('Authenticate: Check Email for existence  ', function() {

  it('should return true when email is already registerd', function(done) {
    Authenticate.ifEmailExists(registeredEmail, function(err, res) {
      if (err) {
        return done(err);
      } else {
        expect(res.emailExists).to.equal(true);
        done();
      }
    });
  })

  it('should return false when email isnot registerd', function(done) {
    Authenticate.ifEmailExists(unregisteredEmail, function(err, res) {
      if (err) {
        return done(err);
      } else {
        expect(res.emailExists).to.equal(false);
        done();
      }
    });
  })

});
