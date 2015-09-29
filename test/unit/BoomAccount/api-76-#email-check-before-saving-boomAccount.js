/**
 * Tests:
 *     create before save hook for boomaccounts to prevent duplicate emails
 */
var chai = require('chai');
var expect = chai.expect;
var app = require('../../../server/server.js');
var BoomCustomer = app.models.BoomCustomer;
var BoomMerchant = app.models.BoomMerchant;

var merchant = {
        "email": "test@user.com",
        "password": "Test123456!",
        "businessName": "Jo-Ann Fabric and Craft",
        "contactPhoneNumber": "9545551234",
        "businessPhoneNumber": "9545556677",
        "websiteUrl": "www.joann.com",
        "primaryAddress": {
          "addressLine1": "4700 Hollywood Blvd",
          "city": "Hollywood",
          "state": "Florida",
          "zip": "33021"
        }
      }
var customer =  {
        "email": "test@user.com",
        "password": "Test123456!",
        "status": "pending",
        "primaryAddress": {
          "addressLine1": "4700 Hollywood Blvd",
          "city": "Hollywood",
          "state": "Florida",
          "zip": "33021"
        }
      }

describe('BoomAccounts: Before Save hook', function() {

  // trying to insert same email for Merchant and customer
  this.timeout(5000);
  it('Should add BoomMerchant to Persisted Model', function(done){
    BoomMerchant.create(merchant, function(err, res) {
      if(err) {
        return done(err);
      } else {
        expect(res).to.have.property('email', 'test@user.com');
        done();
      }

    });
  });

  it('Shouldnot add BoomCustomer to Persisted Model', function(done){
    BoomCustomer.create(customer, function(err, res) {
      console.log(err.message);
      expect(err.message).to.equal('Email Already Registerd for BoomMerchant');
      done();
    });
  });

  // clean data created by test
  after(function(done) {
    BoomMerchant.destroyAll({
      'email': 'test@user.com'
    }, function(err) {
      if (err) {
        return err;
      }
    });
    BoomCustomer.destroyAll({
      'email': 'test@user.com'
    }, function(err) {
      if (err) {
        return err;
      }
    });
    done();
  })
});
