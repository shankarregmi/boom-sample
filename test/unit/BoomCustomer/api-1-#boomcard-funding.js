/**
 * Tests:
 *  it SHOULD add a BoomCustomerFundingEntity to a BoomCustomer if one does not exist
 *  it SHOULD NOT allow a BoomCustomerFundingCC to be added without all required fields
 *  it SHOULD add a BoomCustomerFundingCC to a BoomCustomerFundingEntity
 */
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;
var app = require('../../../server/server.js');
var debug = require('debug')('boom:test:api-1');
var BoomCustomer = app.models.BoomCustomer;
var boomCustomer = new BoomCustomer();
var BoomCustomerFundingEntity = app.models.BoomCustomerFundingEntities;
var BoomCustomerFundingCC = app.models.BoomCustomerFundingCC

describe('BoomCustomer:BoomCard funding ', function() {
  var data,
    fundingEntityId,
    boomCustomerCCId,
    boomCustomerId;
  beforeEach(function(done) {
    BoomCustomer.findOne({
      where: {
        email: 'customer@aol.com'
      }
    }, function(err, result) {

      boomCustomerId = result._id;
      BoomCustomerFundingEntity.create({
        'boomCustomerId': boomCustomerId
      }, function(err, res) {
        if (err) {
          done(err);
        } else {
          fundingEntityId = res._id;
        }
        done();
      });
    });

    CCdata = {
      ccHolderName: "ABC User",
      ccNumber: "xxxx-xxxx-xxxx-xxxx",
      ccLastFour: "xxxx",
      ccExp: new Date(),
      ccType: "VISA",
      ccZip: "ZIPCODE",
      ccCCV2: "SomeStringValue"
    };

  });
  // start tests
  it('get funding entities of current user ', function(done) {
    boomCustomer.getFundingEntities(function(err, res) {
      if (err) {
        return done(err);
      } else {
        assert.equal(res.boomCustomerId.toString(), boomCustomerId.toString());
        done();
      }
    });
  })

  it('should add BoomCustomerFundingCC to BoomCustomerFundingEntity ', function(done) {
    boomCustomer.addFundingCC(fundingEntityId, CCdata, function(err, res) {
      if (err) {
        return done(err);
      }
      if (res) {
        boomCustomerCCId = res._id;
        expect(res).to.have.property('ccHolderName', 'ABC User')
        done();
      }
    });
  })

  it('should get All CC for an FundingEntity', function(done) {
    boomCustomer.getAllCCForAnEntity(fundingEntityId, function(err, res) {
      if (err) {
        return done(err);
      } else {
        assert.equal(Array.isArray(res), true);
        done();
      }
    });
  })

  it('should get a single fundingCC from FundingEntity', function(done) {
    boomCustomer.getCCInfo(fundingEntityId, boomCustomerCCId, function(err, res) {
      if (err) {
        return done(err);
      } else {
        expect(res).to.have.property('ccLastFour')
        done();
      }
    });
  })

  it('should delete fundingCC from fundingEntities of a user ', function(done) {
    boomCustomer.deleteFundingCC(fundingEntityId, boomCustomerCCId, function(err, res) {
      if (err) {
        return done(err);
      } else {
        assert.equal(res, undefined);
        done();
      }
    });
  })

  //clean all data created by test
  after(function(done) {
    BoomCustomerFundingEntity.destroyAll({
      'boomCustomerId': boomCustomerId
    }, function(err) {
      if (err)
        done(err);
      done();
    });
  })
});
