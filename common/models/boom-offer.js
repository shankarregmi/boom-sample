var DoubleFix = require('../helpers/DoubleFix')();
var loopback = require('loopback');
var GeoPoint = loopback.GeoPoint;
var async = require('async');
var _ = require('lodash');
var ObjectID = require('mongodb').ObjectID;
var Q = require('q');
var geocoderProviderSecrets = require(__dirname + '/../../server/geocoder.json');
var geocoder = require('node-geocoder')('google', 'https', geocoderProviderSecrets);
var debug = require('debug')('boom:model:BoomOffer');
module.exports = function(BoomOffer) {
    BoomOffer.disableRemoteMethod('create', true);
    BoomOffer.disableRemoteMethod('upsert', true);
    BoomOffer.disableRemoteMethod('updateAll', true);
    BoomOffer.disableRemoteMethod('destroyById', true);
    BoomOffer.disableRemoteMethod('deleteById', true);
    BoomOffer.disableRemoteMethod('updateById', true);
    BoomOffer.disableRemoteMethod('updateAttributes', false);
    BoomOffer.on('dataSourceAttached', function(boomOfferModel) {
        boomOfferModel.disableRemoteMethod('prototype.__create__cashBack', true);
        boomOfferModel.disableRemoteMethod('prototype.__destroyById__cashBack', true);
        boomOfferModel.disableRemoteMethod('prototype.__updateById__cashBack', true);
        boomOfferModel.disableRemoteMethod('prototype.__delete__cashBack', true);
    });
    BoomOffer.observe('before save', function fixDoubleValue(ctx, next) {
        function Reject(reason) {
            process.nextTick(function() {
                next(reason);
            });
        }

        function Resolve(data) {
            process.nextTick(function() {
                next();
            });
        }
        if (ctx.instance && ctx.instance.cashBack) {
            var vals = ctx.instance.cashBack.value();
            if (Array.isArray(vals) !== true) {
                vals = [vals];
            }
            for (var i = vals.length - 1; i >= 0; i--) {
                var val = vals[i];
                if (typeof val == 'string') {
                    val.cashBackValue = parseFloat(val.cashBackValue);
                }
                val.cashBackValue = DoubleFix(val.cashBackValue);
            }
            _.each(vals, function(cashback, pos) {
                if (typeof cashback === 'object' && (!cashback._id || cashback._id === 'objectid')) {
                    vals[pos]._id = new ObjectID();
                }
            });
        } else if (ctx.data && ctx.data.cashBack) {
            var vals = ctx.data.cashBack.value();
            if (Array.isArray(vals) !== true) {
                vals = [vals];
            }
            for (var i = vals.length - 1; i >= 0; i--) {
                var val = vals[i].cashBackValue;
                if (typeof val == 'string') {
                    val = parseFloat(val);
                }
                cashBack.cashBackValue = DoubleFix(val);
            }
        }
        return Resolve();
    });
    BoomOffer.prototype.peekNextCashBackLevel = function(user, fn) {
        var BoomReservation = loopback.getModel('BoomReservation');
        var self = this;
        BoomReservation.find({
            where: {
                boomCustomerId: user,
                status: 'Purchased',
                boomReservationOffers: {
                    elemMatch: {
                        boomOfferId: self._id
                    }
                }
            },
            order: 'redeemedAt DESC'
        }, function(err, lastReservations) {
            if (err) {
                return fn(err);
            } else if (lastReservations.length === 0) {
                //First reservation for the user for this offer.
                var data = {
                    cashBackLevelId: self.boomOfferCashBacks[0]._id,
                    cashBackAmount: self.boomOfferCashBacks[0].cashBackValue,
                    cashBackPercentCompleted: 0,
                    cashBackLevels: {
                        pos: 0,
                        remaining: self.boomOfferCashBacks.length,
                        next: 1,
                        total: self.boomOfferCashBacks.length
                    }
                };
                return fn(null, data);
            } else {
                var matchingPreviousCashback;
                var stepsLeft = self.boomOfferCashBacks.length - lastReservations.length;
                if (stepsLeft > 0) {
                    var nextStep = self.boomOfferCashBacks.length - stepsLeft;
                    var percentCompleted = ((lastReservations.length / self.boomOfferCashBacks.length) * 100);
                    percentCompleted = (typeof percentCompleted.toFixed === 'function') ? percentCompleted.toFixed(2) : '0';
                    percentCompleted = parseFloat(percentCompleted);
                    var data = {
                        cashBackLevelId: self.boomOfferCashBacks[nextStep]._id,
                        cashBackAmount: self.boomOfferCashBacks[nextStep].cashBackValue,
                        cashBackPercentCompleted: percentCompleted,
                        cashBackLevels: {
                            pos: lastReservations.length,
                            remaining: stepsLeft,
                            next: nextStep,
                            total: self.boomOfferCashBacks.length
                        }
                    };
                    return fn(null, data);
                } else {
                    //Back to square one, completed all offer cashbacks
                    var data = {
                        cashBackLevelId: self.boomOfferCashBacks[0]._id,
                        cashBackAmount: self.boomOfferCashBacks[0].cashBackValue,
                        cashBackPercentCompleted: 0,
                        cashBackLevels: {
                            pos: 0,
                            remaining: self.boomOfferCashBacks.length,
                            next: 1,
                            total: self.boomOfferCashBacks.length
                        }
                    };
                    return fn(null, data);
                }
            }
        });
    }
    BoomOffer.nearby = function(here, page, limit, max, category, name, tags, minPrice, maxPrice, locationText, fn) {
        // check for here filter specifier presence
        var GPSCordsCalculatorDeferred = Q.defer();

        function GPSCordsCalculator(location) {
            geocoder.geocode(location, function(err, res) {
                if (err) {
                    GPSCordsCalculatorDeferred.reject(new Error(err));
                } else {
                    var data = {
                        lat: res[0].latitude,
                        lng: res[0].longitude
                    }
                    GPSCordsCalculatorDeferred.resolve(data);
                }
            });
            return GPSCordsCalculatorDeferred.promise;
        }
        if (typeof page === 'function') {
            fn = page;
            page = 0;
            max = 0;
        }
        if (typeof limit === 'function') {
            fn = limit;
            limit = 0;
        }
        if (typeof max === 'function') {
            fn = max;
            max = 0;
        }
        if (typeof name === 'function') {
            fn = name;
            name = '';
        }
        if (typeof tags === 'function') {
            fn = tags;
            tags = '';
            minPrice = 0;
            maxPrice = 99999;
        }
        if (typeof minPrice === 'function') {
            fn = minPrice;
            minPrice = 0;
            maxPrice = 99999;
        }
        if (typeof maxPrice === 'function') {
            fn = maxPrice;
            maxPrice = 99999;
        }
        // if GPS Cords are not provided use locationText to calculate gps coordinate
        if (here && !_.isEmpty(here)) {
            findStore(here)
        } else {
            GPSCordsCalculator(locationText).then(function(data) {
                findStore(data);
            }, function(error) {
                return fn(err, null)
            })
        }

        function findStore(data) {
            limit = limit || 10;
            page = page || 1;
            max = Number(max || 100);
            here = new GeoPoint(data);
            name = name || '';
            page = (page - 1) * limit;
            /**
            @function ? take a filter name and its array to create the proper query object
            @param {String} filter - name of the filter to be processed
            @param {Array} arr - array to be converted in query array object
            **/
            var iterator = function(filter, arr) {
                var result = [];
                if (Array.isArray(arr) && arr.length > 0) {
                    for (var i = 0; i < arr.length; i++) {
                        if (arr[i] !== '') {
                            var obj = new Object;
                            arr[i] = new RegExp('.*' + arr[i] + '.*', 'i'); //non case sensitive regex
                            obj[filter] = {
                                like: arr[i]
                            };
                            result.push(obj);
                        }
                    };
                }
                return result;
            };
            var mainQuery = []; //main query array
            var priceQuery = {};
            mainQuery = mainQuery.concat(iterator('category', category)); //analize category filter
            mainQuery = mainQuery.concat(iterator('tags', tags)); //analize tags filter
            if (maxPrice > 0 && minPrice > 0) priceQuery = [{
                'price': {
                    gte: minPrice
                }
            }, {
                'price': {
                    lte: maxPrice
                }
            }];
            else if (maxPrice > 0) priceQuery = [{
                'price': {
                    lte: maxPrice
                }
            }];
            else if (minPrice > 0) priceQuery = [{
                'price': {
                    gte: minPrice
                }
            }];
            else priceQuery = [{}];
            /*if filter name is empty don't push
            it to the main query array: mainQuery*/
            if (name !== '') {
                name = new RegExp('.*' + name + '.*', 'i'); //non case sensitive regex
                var obj = {
                    name: {
                        like: name
                    }
                };
                mainQuery.push(obj);
            }
            /*Note: or filter doesn't allow empty
            array, if array is empty add empty Object*/
            if (mainQuery.length === 0) {
                mainQuery.push({});
            }
            debug(priceQuery);
            debug('Price query: \r\n' + JSON.stringify(priceQuery));
            debug('Query limit ' + limit + ' page ' + page);
            debug('Searching %d %s', max, JSON.stringify(here));
            var BoomStore = loopback.getModel('BoomStore');
            BoomStore.find({
                fields: ['_id', 'storeLabel', 'storePhoneNumber', 'loc', 'primaryAddress'],
                include: {
                    relation: 'offers',
                    scope: {
                        where: {
                            or: mainQuery,
                            and: priceQuery //main query array
                        }
                    }
                },
                where: {
                    loc: {
                        near: here,
                        maxDistance: max
                    }
                },
                //limit and offset(skip) for pagination
                limit: limit,
                skip: page
            }, function(err, result) {
                debug('Query found ' + result.length + ' offers');
                var storesWithOffers = _.filter(result, function(store) {
                    return store.offers;
                });
                debug('Filtered down to ' + storesWithOffers.length + ' offers');
                fn(err, storesWithOffers);
            });
        }
    };
    BoomOffer.setup = function() {
        BoomOfferModel = this;
        BoomOffer.base.setup.apply(this, arguments);
        this.remoteMethod('peekNextCashBackLevel', {
            isStatic: false,
            description: 'Check to see which cashback level the user is eligable for',
            accepts: [{
                arg: 'user',
                type: 'String',
                description: 'BoomCustomer id',
                required: true,
                'http': {
                    source: 'path'
                }
            }],
            returns: {
                arg: 'result',
                root: true
            },
            http: {
                verb: 'GET',
                path: '/:user/peek'
            }
        });
        this.remoteMethod('nearby', {
            description: 'Find nearby offers around the geo point',
            accepts: [{
                arg: 'here',
                type: 'GeoPoint',
                description: 'geo location (lng & lat)'
            }, {
                arg: 'page',
                type: 'Number',
                description: 'number of pages (page size=10)'
            }, {
                arg: 'limit',
                type: 'Number',
                description: 'limit of offers to show'
            }, {
                arg: 'max',
                type: 'Number',
                description: 'max distance in miles'
            }, {
                arg: 'category',
                type: ['string'],
                description: 'offer category'
            }, {
                arg: 'name',
                type: 'String',
                description: 'Offer name'
            }, {
                arg: 'tags',
                type: ['string'],
                description: 'Offer tags'
            }, {
                arg: 'minPrice',
                type: 'Number',
                description: 'Minimum Price'
            }, {
                arg: 'maxPrice',
                type: 'Number',
                description: 'Max Price'
            }, {
                arg: 'locationText',
                type: 'String',
                description: 'Location in text'
            }],
            returns: {
                type: ['BoomOffer'],
                root: true
            },
            http: {
                verb: 'GET'
            }
        });
    };
    BoomOffer.setup();
    BoomOffer.disableRemoteMethod('createChangeStream', true);
};