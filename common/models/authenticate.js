var Q = require('q');
var request = require('request');

module.exports = function(Authenticate) {
    Authenticate.setup = function() {
        var self = this;
        self.disableRemoteMethod('create', true);
        self.disableRemoteMethod('upsert', true);
        self.disableRemoteMethod('exists', true);
        self.disableRemoteMethod('deleteById', true);
        self.disableRemoteMethod('find', true);
        self.disableRemoteMethod('findOne', true);
        self.disableRemoteMethod('findById', true);
        self.disableRemoteMethod('count', true);
        self.disableRemoteMethod('invoke', true);
        self.disableRemoteMethod('update', true);
        self.disableRemoteMethod('updateAll', true);
        self.disableRemoteMethod('MerchantLogin', true);
        self.disableRemoteMethod('updateAttributes', false);
        self.disableRemoteMethod('updateAttributes', true);
        self.disableRemoteMethod('createChangeStream', true);

        Authenticate.resetPassword = function(id, credentialData, fn) {
            var BoomAccount = self.app.models.BoomAccount;
            var email = credentialData.email;
            BoomAccount.determineType(email, function(err, type) {
                if (err) {
                    return fn(err);
                } else {
                    type.findById(id, function(err, account) {
                        account.changePassword(credentialData, function(err, changed) {
                            if (err) {

                            }
                        });
                    });
                }
            })

        }
        Authenticate.ifEmailExists = function(email, fn) {
            var self = this;
            var BoomAccount = self.app.models.BoomAccount;
            var emailAddress = email.email;
            BoomAccount.determineType(emailAddress, function(err, type) {
                var cData = {}
                if (!type && 'Username and password is not valid' === err.message) {
                    cData.emailExists = false;
                    return fn(null, cData);
                } else if (type && !err) {
                    cData = {
                        emailExists: true,
                        accountType: type.modelName
                    }
                    return fn(null, cData);
                } else {
                    return fn(err, null);
                }
            });
        };

        Authenticate.login = function(credentials, include, fn) {
            var BoomStore, BoomCustomer, BoomMerchant;

            BoomStore = self.app.models.BoomStore;
            BoomCustomer = self.app.models.BoomCustomer;
            BoomMerchant = self.app.models.BoomMerchant;
            BoomStaff = self.app.models.BoomStaff;
            User = self.app.models.User;

            function reject(statusCode, message) {
                process.nextTick(function() {
                    var err = new Error('Username and password is not valid');
                    err.status = 401;
                    return fn(err);
                });
            }
            var username = credentials.username || credentials.email;
            credentials.email = username;
            delete credentials.username;
            var password = credentials.password;
            if (!username || !password) {
                return fn(new Error({
                    message: 'Username and password is not valid'
                }));
            }
            var customerUsernameCheckDeferred = Q.defer();
            var merchantUsernameCheckDeferred = Q.defer();
            var storeUsernameCheckDeferred = Q.defer();
            var staffUsernameCheckDeferred = Q.defer();
            BoomStore.findOne({
                where: {
                    email: username
                }
            }, function(err, user) {
                if (!!user) {
                    storeUsernameCheckDeferred.resolve('store');
                } else {
                    storeUsernameCheckDeferred.reject();
                }
            });
            BoomCustomer.findOne({
                where: {
                    email: username
                }
            }, function(err, user) {
                if (!!user) {
                    customerUsernameCheckDeferred.resolve('customer');
                } else {
                    customerUsernameCheckDeferred.reject();
                }
            });
            BoomMerchant.findOne({
                where: {
                    email: username
                }
            }, function(err, user) {
                if (!!user) {
                    merchantUsernameCheckDeferred.resolve('merchant');
                } else {
                    merchantUsernameCheckDeferred.reject();
                }
            });
            BoomStaff.findOne({
                where: {
                    email: username
                }
            }, function(err, user) {
                if (!!user) {
                    staffUsernameCheckDeferred.resolve('staff');
                } else {
                    staffUsernameCheckDeferred.reject();
                }
            });

            Q.allSettled([customerUsernameCheckDeferred.promise, merchantUsernameCheckDeferred.promise, storeUsernameCheckDeferred.promise, staffUsernameCheckDeferred.promise]).then(function(results) {
                var type = false;
                var login = null;
                results.every(function(result) {
                    if (result.state === "fulfilled") {
                        type = result.value;
                        switch (type) {
                            case 'merchant':
                                {
                                    BoomMerchant.login(credentials, include, fn);
                                    break;
                                }
                            case 'store':
                                {
                                    BoomStore.login(credentials, include, fn);
                                    break;
                                }
                            case 'customer':
                                {
                                    BoomCustomer.login(credentials, include, fn);
                                    break;
                                }
                            case 'staff':
                                {
                                    BoomStaff.login(credentials, include, fn);
                                    break;
                                }
                            default:
                                {
                                    type = false;
                                }
                        }
                        return false;
                    } else {
                        return true;
                    }
                });
                if (type === false) {
                    return reject();
                }
            });
        };

        self.remoteMethod('login', {
            description: 'Login a user with email and password.',
            accepts: [{
                arg: 'credentials',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            }, {
                arg: 'include',
                type: ['string'],
                http: {
                    source: 'query'
                },
                description: 'Related objects to include in the response. ' + 'See the description of return value for more details.'
            }],
            returns: {
                arg: 'accessToken',
                type: 'object',
                root: true,
                description: 'The response body contains properties of the AccessToken created on login.\n' + 'Depending on the value of `include` parameter, the body may contain ' + 'additional properties:\n\n' + '  - `user` - `{User}` - Data of the currently logged in user. (`include=user`)\n\n'
            },
            http: {
                verb: 'post',
                path: '/'
            }
        });
        self.remoteMethod('ifEmailExists', {
            description: 'Checks if an email is already registered',
            accepts: [{
                arg: 'email',
                type: 'Object',
                required: true,
                http: {
                    source: 'body'
                }
            }],
            returns: {
                arg: 'emailValidity',
                type: 'object',
                root: true,
                description: 'The response body contains an object stating if email was valid'
            },
            http: {
                verb: 'post',
                path: '/exists'
            }
        });

    };
    Authenticate.setup();
};
