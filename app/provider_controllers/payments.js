var User = require('mongoose').model('User');
var crypto = require('crypto');
require('../controllers/constant');
var constants = require('../../constants.json');
var jwt = require('jsonwebtoken');
var utils = require('../controllers/utils');
var allemails = require('../controllers/emails');
var moment = require('moment');
var nodemailer = require('nodemailer');
var Setting = require('mongoose').model('Settings');
var Provider = require('mongoose').model('Provider');
var Trip = require('mongoose').model('Trip');
var request = require('request');
var Trip_Service = require('mongoose').model('trip_service');
var Trip_Location = require('mongoose').model('trip_location');
var Country = require('mongoose').model('Country');
var City = require('mongoose').model('City');
var Card = require('mongoose').model('Card');
var console = require('../controllers/console');
var utils = require('../controllers/utils');

exports.provider_payments = function (req, res, next) {
    if (typeof req.session.provider != "undefined")
    {
        Card.find({user_id: req.session.provider._id, is_default: 1}).then((card) => { 
            Provider.findOne({_id: req.session.provider._id}).then((provider_detail) => { 
                Card.find({user_id: req.session.provider._id, is_default: 0}).then((cards) => { 
                    
                   
                    res.render("provider_payments", {Selected_card: card, provider_detail: provider_detail, provider_id: req.session.provider._id, Other_card: cards, stripe_public_key: setting_detail.stripe_publishable_key});
                    delete message;
                });
            });
        });
    } else
    {
        res.redirect('/login');
    }

}

exports.check_card = function (req, res) {
    Card.find({user_id: req.body.user_id}).then((card) => { 
        if (card.length == 0) {
            res.json({success: false});
        } else {
            res.json({success: true});
        }
    });
}

exports.card_type = function (req, res) {
    if (typeof req.session.provider != "undefined")
    {
        var Card_number = req.body.Card_number;
        Card_number = Card_number.replace(/ /g, '')
        var creditCardType = require('credit-card-type');
        var visaCards = creditCardType(Card_number);
        res.json(visaCards[0]);
    } else
    {
        res.redirect('/login');
    }
}

exports.add_card = function (req, res) {
    if (typeof req.session.provider != "undefined")
    {
        Provider.findOne({_id: req.session.provider._id}).then((user) => { 

            
            var stripe_secret_key = setting_detail.stripe_secret_key;
            var email = user.email;
            var stripe = require("stripe")(stripe_secret_key);
            var payment_token = req.body.payment_token;
            var customer = stripe.customers.create({
                description: user.email,
                        source: payment_token // obtained with Stripe.js

                    }, function (err, customer) {
                        if (!customer) {
                            res.json({success: false, error_code: error_message.ERROR_CODE_FOR_ENTER_VALID_PAYMENT_TOKEN});
                        } else {

                            Card.find({user_id: req.session.provider._id}).then((card_data) => { 
                             

                                var customer_id = customer.id;
                                var card = new Card({
                                    payment_id: req.body.payment_id,
                                    user_id: req.session.provider._id,
                                    token: req.body.token,
                                    last_four: req.body.last_four,
                                    type: req.body.type,
                                    payment_token: payment_token,
                                    card_type: req.body.card_type,
                                    customer_id: customer_id
                                });
                                if (card_data.length > 0) {
                                    card.is_default = constant_json.NO;
                                } else {
                                    card.is_default = constant_json.YES;
                                }
                                card.save().then(() => { 
                                    message = admin_messages.success_message_add_card;
                                    res.redirect('/provider_payments');
                                }, (err) => {
                                    utils.error_response(err, res)
                                });
                                
                            });
                        }

                    });
            
        });
    } else
    {
        res.redirect('/login');
    }
};



exports.delete_card = function (req, res) {

    if (typeof req.session.provider != "undefined")
    {
        Card.remove({_id: req.body.card_id, user_id: req.session.provider._id}).then(() => { 
            if (req.body.is_default == 1)
            {
                Card.findOneAndUpdate({user_id: req.session.provider._id}, {is_default: constant_json.YES}, function (err, card) {

                })
            }
            res.json({success: true});
            
        });

    } else
    {
        res.redirect('/login');
    }
};

exports.card_selection = function (req, res) {
    if (typeof req.session.provider != "undefined")
    {
        Card.findOneAndUpdate({_id: req.body.card_id, user_id: req.session.provider._id}, {is_default: constant_json.YES}).then((card) => { 

            Card.findOneAndUpdate({_id: {$nin: req.body.card_id}, user_id: req.session.provider._id, is_default: constant_json.YES}, {is_default: constant_json.NO}).then((card) => { 
                
                res.json({success: true});
            });

        });
    } else
    {
        res.redirect('/login');
    }
};


exports.provider_add_wallet_amount = function (req, res, next) {
    if (typeof req.session.provider != "undefined") {
        payment_id = req.body.payment_id;
        
        if (typeof payment_id != "undefined") {
            jwt.sign({
                id: payment_id,
                msisdn: constants.ZAIN_CASH_MSISDN,
            }, constants.ZAIN_CASH_SERCRET_KEY, {
                expiresIn: '4h'
            }, function (err, token) {
                request.post({
                    url: 'https://test.zaincash.iq/transaction/get',
                    form: {
                        token: token,
                        merchantId: constants.ZAIN_CASH_MERCHANTID
                    }
                }, function (err, httpResponse, body) {
                    var transaction = JSON.parse(body);
                    var amount = transaction.amount;

                    Provider.findOne({ _id: req.session.provider._id }).then((provider) => {
                        if (provider.wallet_currency_code == "IQD") {
                            var total_wallet_amount = utils.addWalletHistory(type, provider.unique_id, provider._id, provider.country_id, provider.wallet_currency_code, provider.wallet_currency_code,
                                1, amount, provider.wallet, constant_json.ADD_WALLET_AMOUNT, constant_json.ADDED_BY_CARD, "Zain Cash Payment ID " + payment_id);

                            provider.wallet = total_wallet_amount;

                            provider.save().then(() => {
                                message = `Amount ${amount} is Added Sucessfully to your Wallet.`;
                                res.status(204).send();
                            }, (err) => {
                                utils.error_response(err, res)
                            });
                        } else {
                            res.status(400).send({ message: "Provider's Wallet Currency Must be in IQD" })
                        }
                    });
                })
            });
        } else {
            res.status(400).send({ message: "Invalid Payment ID or Amount" })
        }
    } else {
        res.redirect('/login');
    }
};


exports.request_zaincash_payment = function (req, res, next) {
    if (typeof req.session.provider != "undefined") {
        var amount = Number(req.body.amount);

        if (amount >= 1000) {
            jwt.sign({
                amount: 1000,
                serviceType: constants.ZAIN_CASH_SERVICE_TYPE,
                msisdn: constants.ZAIN_CASH_MSISDN,
            }, constants.ZAIN_CASH_SERCRET_KEY, {
                expiresIn: '4h'
            }, function (err, token) {
                // todo: change test to api.
                request.post({
                    url: 'https://test.zaincash.iq/transaction/init',
                    form: {
                        token: token,
                        merchantId: constants.ZAIN_CASH_MERCHANTID,
                        lang: "ar"
                    }
                }, function (err, httpResponse, body) {
                    var body = JSON.parse(body);
                    if (body.id)
                        return res.redirect('https://test.zaincash.iq/transaction/pay?id=' + body.id);
                    return res.redirect('/payment?msg=cannot_generate_token');
                })
            });
        } else {
            res.status(400).send({ message: "Invalid Payment Amount" })
        }
    } else {
        res.redirect('/login');
    }
}


//exports.provider_add_wallet_amount = function (req, res, next) {
//    console.log("provider_add_wallet_amount ----");
//    if (typeof req.session.provider != 'undefined') {
//        Provider.findById(req.session.provider._id, function (err, user_data) {
//            if (user_data)
//            {
//                
//                var wallet = utils.precisionRoundTwo(Number(req.body.wallet));
//                var total_wallet_amount = utils.addWalletHistory(process.env.PROVIDER_UNIQUE_NUMBER, user_data.unique_id, user_data._id, user_data.country_id, user_data.wallet_currency_code, user_data.wallet_currency_code,
//                        1, wallet, user_data.wallet, process.env.ADD_WALLET_AMOUNT, process.env.ADDED_BY_ADMIN, "By Admin")
//
//                user_data.wallet = total_wallet_amount;
//                user_data.save();
//                res.redirect('/provider_payments');
//            } else
//            {
//                
//                res.redirect('/login');
//            }
//        })
//    } else
//    {
//        res.redirect('/login');
//    }
//};