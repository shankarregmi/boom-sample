var loopback = require('loopback');
var Q = require('q');
var app = require('../../server/server.js');
module.exports = function(BoomCustomer) {
    BoomCustomer.disableRemoteMethod('login', true);
    BoomCustomer.disableRemoteMethod('logout', true);
    BoomCustomer.disableRemoteMethod('reset', true);
    BoomCustomer.disableRemoteMethod('confirm', true);
    BoomCustomer.disableRemoteMethod('accessTokens', true);
    BoomCustomer.disableRemoteMethod('updateAll', true);
    BoomCustomer.disableRemoteMethod('__get__accessTokens', false);
    BoomCustomer.disableRemoteMethod('__getById__accessTokens', false);
    BoomCustomer.disableRemoteMethod('__getById__accessTokens__count', false);
    BoomCustomer.disableRemoteMethod('__updateById__accessTokens', false);
    BoomCustomer.disableRemoteMethod('__destroyById__accessTokens', false);
    BoomCustomer.disableRemoteMethod('__get__fundingEntities', false);
    BoomCustomer.disableRemoteMethod('create', true);
    BoomCustomer.disableRemoteMethod('deleteById', true);
    BoomCustomer.beforeRemote('create', function(ctx, user, next) {
        var body = ctx.req.body;
        if (!body) {
            return next(new Error({
                message: 'Empty body'
            }));
        }
        if (body.status) {
            body.status = 'Pending';
        }
        if (body.id) {
            delete body.id;
        }
        if (body.username) {
            delete body.username;
        }
        next();
    });
    BoomCustomer.beforeRemote('__create__reservations', function(ctx, user, next) {
        var body = ctx.req.body;
        var loggedInUser = ctx.req.accessToken;
        var self = this;
        if (body && body.boomReservationOffers && Array.isArray(body.boomReservationOffers)) {
            var offers = body.boomReservationOffers;
            for (var i = offers.length - 1; i >= 0; i--) {
                offers[i].boomCustomerId = self._id;
            }
            next();
        } else {
            next();
        }
    });

    BoomCustomer.beforeRemote('prototype.__create__reviews', function(ctx, user, next) {
        var body = ctx.req.body;
        var rating = body.rating;
        var self = this;
        var BoomReservation = BoomCustomer.app.models.BoomReservation;
        if(!body.relatedPurchaseId) {
            return next(new Error('Related Purchase Id is required'))
        } else if(rating < 0 || rating > 5) {
            return next(new Error('Rating must be within limit of 0 to 5'));
        } else {
            BoomReservation.findOne({
                where: {
                    _id: body.relatedPurchaseId
                }
            }, function(err, res) {
                if(err || !res || !Object.keys(res).length)
                    return next(err || new Error('No reservation found for such Id'))
                if(res.boomCustomerId.toString() !== ctx.instance._id.toString()) {
                    return next(new Error('The reservation doesn\'t belong to the user'));
                } else {
                    return next();
                }
            })
        }
    });
    
    BoomCustomer.register = function(registerData, fn) {
        var me = this;
        var promises = [];
        var registerDataValid = Q.defer();
        promises.push(registerDataValid.promise);
        registerData.isValid(function(valid) {
            if (valid) {
                return registerDataValid.resolve();
            } else {
                var err = new Error();
                err.message = JSON.stringify(registerData.errors);
                err.statusCode = 422;
                return registerDataValid.reject(err);
            }
        });
        var accountCheckDeferred = Q.defer();
        var userName = registerData.username || registerData.email;
        var defaultError = new Error('Registration failed');
        defaultError.statusCode = 401;
        defaultError.code = 'REGISTER_FAILED';
        BoomCustomer.count({
            'email': userName
        }, function(err, count) {
            if (err) accountCheckDeferred.reject(err);
            if (count !== 0) {
                defaultError.statusCode = 409;
                defaultError.code = 'USERNAME_PREVIOUSLY_REGISTERED';
                accountCheckDeferred.reject(defaultError);
            }
            accountCheckDeferred.resolve();
        });
        promises.push(accountCheckDeferred.promise);
        if (registerData.card) {
            var cardCheckDeferred = Q.defer();
            var BoomCard = loopback.getModel('BoomCard');
            promises.push(cardCheckDeferred.promise);
            BoomCard.count({
                'cardNumber': registerData.card
            }, function(err, count) {
                console.log('card count : ' + count);
                if (err) cardCheckDeferred.reject(err);
                if (count !== 0) {
                    defaultError.statusCode = 409;
                    defaultError.code = 'USERNAME_PREVIOUSLY_REGISTERED';
                    cardCheckDeferred.reject(defaultError);
                }
                cardCheckDeferred.resolve();
            });
        }
        Q.all(promises).then(function() {
            //fn(null,'sms verification in progress');
            var customerToBeSaved = {
                'email': userName,
                'personPhone': {
                    'mobilePhone': registerData.mobilePhone,
                }
            };
            BoomCustomer.create(customerToBeSaved, function(err, customer) {
                if (err) return fn(err);
                var sendEmailDeferred = Q.defer();
                var sendSMSDeferred = Q.defer();
                var customerData = customer.toJSON();
                var options = {
                    to: customer.email,
                    from: 'no-reply@boomcarding.com',
                    subject: 'Account created',
                    html: 'This is a test mail'
                };
                BoomCustomer.sendEmail(options, function(err, success) {
                    if (err) {
                        return sendEmailDeferred.reject(err);
                    } else if (!success) {
                        customer.destroy(function() {
                            err = new Error('Could not send verification email, account removed');
                            err.statusCode = 500;
                            return sendEmailDeferred.reject(err);
                        });
                    } else {
                        sendEmailDeferred.resolve(customerData);
                    }
                });
                customer.verifySMS(function(err, response) {
                    var id = customer._id.toString();
                    var confirmUrl = '/api/customer/confirmSMS?userId=' + id;
                    customerData.confirmUrl = confirmUrl;
                    sendSMSDeferred.resolve(customerData);
                });
                sendEmailDeferred.promise.then(sendSMSDeferred.promise).then(function(customer) {
                    fn(null, customer);
                }).catch(function(err) {
                    fn(err);
                });
            });
        }, function(err) {
            fn(err);
        });
    };
    BoomCustomer.getType = function() {
        return BoomCustomer.modelName;
    };
    BoomCustomer.sanitizeRegistration = function(data) {
        //Make sure we have email
    };
    BoomCustomer.prototype.getFundingEntities = function(fn) {
        var self = this;
        var BoomFundingEntities = loopback.getModel('BoomCustomerFundingEntities');
        BoomFundingEntities.findOne({
            where: {
                boomCustomerId: self._id
            },
            include: ['chargeCards']
        }, function(err, results) {
            if (err) {
                return fn(err);
            }
            return fn(null, results);
        });
    };
    BoomCustomer.prototype.addFundingCC = function(boomCustomerFundingEntityId, boomCustomerFundingCC, fn) {
        var self = this;
        var BoomFundingEntities = loopback.getModel('BoomCustomerFundingEntities');
        var BoomFundingCC = loopback.getModel('BoomCustomerFundingCC');
        var ccData = boomCustomerFundingCC
        BoomFundingEntities.findOne({
            where: {
                'boomCustomerId': self._id,
                '_id': boomCustomerFundingEntityId
            }
        }, function(err, entityInstance) {
            if (err) {
                return fn(err);
            }
            ccData.boomCustomerFundingEntityId = entityInstance._id
            BoomFundingCC.create(ccData, function(err, ccInstance) {
                if (err) {
                    return fn(err);
                }
                return fn(null, ccInstance);
            });
        });
    };
    BoomCustomer.prototype.deleteFundingCC = function(boomCustomerFundingEntityId, boomCustomerCCId, fn) {
        var self = this;
        var BoomFundingEntities = loopback.getModel('BoomCustomerFundingEntities');
        var BoomFundingCC = loopback.getModel('BoomCustomerFundingCC');
        BoomFundingCC.destroyById(boomCustomerCCId, function(err) {
            return fn(err);
        });
    };
    BoomCustomer.prototype.getAllCCForAnEntity = function(boomCustomerFundingEntityId, fn) {
        var self = this;
        var BoomFundingCC = loopback.getModel('BoomCustomerFundingCC');
        var BoomFundingEntities = loopback.getModel('BoomCustomerFundingEntities');
        BoomFundingEntities.findOne({
            where: {
                'boomCustomerId': self._id,
                '_id': boomCustomerFundingEntityId
            },
        }, function(err, entityInstance) {
            if (err) {
                return fn(err);
            }
            BoomFundingCC.find({
                'boomCustomerFundingEntityId': entityInstance._id
            }, function(err, result) {
                return fn(err, result);
            });
        });
    };
    BoomCustomer.prototype.getCCInfo = function(boomCustomerFundingEntityId, ccId, fn) {
        var self = this;
        var BoomFundingCC = loopback.getModel('BoomCustomerFundingCC');
        var BoomFundingEntities = loopback.getModel('BoomCustomerFundingEntities');
        BoomFundingCC.findOne({
            where: {
                '_id': ccId
            }
        }, function(err, result) {
            if (err) {
                return fn(err);
            } else {
                return fn(null, result);
            }
        })
    };

    BoomCustomer.prototype.verifySMS = function(fn){
        if(!this.personPhone.mobilePhone){
            return fn(new Error('Mobile phone is not set for account'));
        }
        this.constructor.base.prototype.verifySMS.call(this, this.personPhone.mobilePhone, fn);
    };

    BoomCustomer.confirmSMS = function(pinCode, userId, callback) {
        var BoomAccount = loopback.getModel('BoomAccount');
        var self = this;
        userId =  userId || pinCode._id;
        var pin = pinCode.code;
        var defaultErr = new Error('The pincode does not match or was not found');
        BoomCustomer.findOne({
            where: {
                _id: userId
            }
        }, function(err, customer) {
            if (customer && customer.verificationToken === pin) {
                customer.status = 'Active';
                customer.verifiedSMS = true;
                customer.save(function(error) {
                    if (error){
                        return callback(error);  
                    } else {
                        return callback(null, {verified: true});    
                    }
                    
                });
            } else {
                defaultErr.statusCode = 404;
                return callback(defaultErr);
            }
        });
    };
    BoomCustomer.remoteMethod('getFundingEntities', {
        description: 'Get the funding entities for the logged in user',
        isStatic: false,
        returns: {
            type: 'BoomCustomerFundingEntities',
            root: true,
            description: 'The response body contains the BoomCustomerFundingEntities for the user.'
        },
        http: {
            verb: 'get',
            path: '/fundingEntities'
        }
    });
    BoomCustomer.remoteMethod('addFundingCC', {
        description: 'Add a funding CC to the fundingEntities of a user',
        isStatic: false,
        accepts: [{
            arg: 'fk',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }, {
            arg: 'data',
            type: 'BoomCustomerFundingCC',
            required: true,
            http: {
                source: 'body'
            }
        }],
        returns: {
            type: 'BoomCustomerFundingCC',
            root: true,
            description: 'The response body contains the newly BoomCustomerFundingCC for the user.'
        },
        http: {
            verb: 'post',
            path: '/fundingEntities/:fk/chargeCard'
        }
    });
    BoomCustomer.remoteMethod('deleteFundingCC', {
        description: 'Deletes a funding CC from fundingEntities of a user',
        isStatic: false,
        accepts: [{
            arg: 'fk',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }, {
            arg: 'ccId',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }],
        returns: {
            type: 'err',
            root: true,
            description: 'Action didn\'t completed and contains error'
        },
        returns: {
            type: null,
            root: true,
            description: 'Action completed successfully without error'
        },
        http: {
            verb: 'delete',
            path: '/fundingEntities/:fk/chargeCard/:ccId'
        }
    });
    BoomCustomer.remoteMethod('getAllCCForAnEntity', {
        description: 'Retrieves all CC from fundingCC collections of a user',
        isStatic: false,
        accepts: [{
            arg: 'fk',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }],
        returns: {
            type: 'err',
            root: true,
            description: 'Action didn\'t completed and contains error'
        },
        returns: {
            type: 'BoomCustomerFundingCC',
            root: true,
            description: 'The response body contains the BoomCustomerCCs for the user.'
        },
        http: {
            verb: 'get',
            path: '/fundingEntities/:fk/chargeCard'
        }
    });
    BoomCustomer.remoteMethod('getCCInfo', {
        description: 'Retrieves a CC document from fundingCC collections of a user with its _id',
        isStatic: false,
        accepts: [{
            arg: 'fk',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }, {
            arg: 'ccId',
            type: 'String',
            required: true,
            http: {
                source: 'path'
            }
        }],
        returns: {
            type: 'err',
            root: true,
            description: 'Action didn\'t completed and contains error'
        },
        returns: {
            type: 'BoomCustomerFundingCC',
            root: true,
            description: 'The response body contains the BoomCustomerCCs for the id.'
        },
        http: {
            verb: 'get',
            path: '/fundingEntities/:fk/chargeCard/:ccId'
        }
    });
    BoomCustomer.remoteMethod('register', {
        description: 'Register a new user with a email and mobilePhone or BoomCard.',
        isStatic: true,
        accepts: [{
            arg: 'registerData',
            type: 'BoomCustomerRegisterData',
            required: true,
            http: {
                source: 'body'
            },
            description: 'BoomCustomerRegisterData'
        }],
        returns: {
            arg: 'accessToken',
            type: 'object',
            root: true,
            description: 'The response body contains the AccessToken for the registrant to login with'
        },
        http: {
            verb: 'post'
        }
    });
    BoomCustomer.remoteMethod('confirmSMS', {
        description: 'validate sms pin code',
        isStatic: true,
        accepts: [{
            arg: 'pinCode',
            type: 'PersonPhoneConfirmCode',
            required: true,
            http: {
                source: 'body'
            },
            description: 'userId as the userId and code as the 6 digit code.'
        }, {
            arg: 'userId',
            type: 'String',
            required: true,
            http: {
                source: 'query'
            },
            description: 'The userId of the user. Can be sent in body instead of query path'
        }],
        returns: {
            arg: 'result',
            type: 'object',
            root: true,
            description: 'HTTP Status Code 200 or 404'
        },
        http: {
            verb: 'post'
        }
    });
    BoomCustomer.setup = function() {
        BoomCustomer.base.setup.call(this);
        var BoomCustomerModel = this;
    };
}