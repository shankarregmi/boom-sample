/**
 * Tests: Boom Avatar
 *  it SHOULD upload avatar to Amazon S3
 *  it SHOULD get signed URL from S3 Bucket
 *  it SHOULD add file description on local mongo instance
 */
var http = require('http');
var chai = require('chai');
var supertest = require('supertest');
var request = supertest('localhost:4000');
var expect = chai.expect;
var assert = chai.assert;
var app = require('../../../server/server.js');
var debug = require('debug')('boom:test:api-50');
var Authenticate = app.models.Authenticate;
var CloudFile = app.models.CloudFile;
var credentials = {
  'email': 'carolyn@aol.com',
  'password': 'Test123456!'
};
var _user = {};

describe('BoomAvatar: Boom Avatar Upload and Download ', function() {
  this.timeout(15000);
  before(function(done) {
    app.start();
    Authenticate.login(credentials, function(err, response) {
      if (!err && response) {
        _user.access_token = response.id;
        _user.userType = response.userType;
        _user._id = response.userId;
        done();
      }
    });
  });

  // start test
  it('SHOULD upload avatar to Amazon S3', function(done) {
    var _url = '/api/' + _user.userType + '/' + _user._id + '/' + _user.userType + '/upload?access_token=' + _user.access_token;
    request.post(_url)
      .attach('file', './server/uploads/test.png')
      .end(function(err, res) {
        expect(res. statusCode).to.equal(200);
        done();
      });
  });

  it('SHOULD get signed URL from S3 Bucket', function(done) {
    var _url = 'http://localhost:4000' + '/api/' + _user.userType + '/' + _user._id + '/' + 'getAvatar?access_token=' + _user.access_token;

    http.get(_url, function(res) {
      assert.equal(res.statusCode, 200);
      res.on('data', function() { });
      res.on('end', function() {
        done();
      });
    });
  });
  it('SHOULD not get signed URL from S3 Bucket if un-authorized user', function(done) {
    var _url = 'http://localhost:4000' + '/api/' + _user.userType + '/' + _user._id + '/' + 'getAvatar?access_token=' + _user.access_token+'1234';

    http.get(_url, function(res) {
      assert.equal(res.statusCode, 401);
      res.on('data', function() { });
      res.on('end', function() {
        done();
      });
    });
  });

  it('SHOULD add file description on local mongo instance', function(done) {
    CloudFile.findOne({
      where: {
        ownerId: _user.userId
      }
    }, function(err, res) {
      expect(res.ownerId.toString()).to.equal(_user._id.toString());
      done();
    });
  });
});
