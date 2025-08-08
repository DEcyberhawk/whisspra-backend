const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const logger = require('../config/logger');
const User = require('../models/userModel');


// @desc    Create a stripe payment intent
// @route   POST /api/payments/create-payment-intent
// @access  Private
exports.createPaymentIntent = async (req, res, next) => {
    if (!stripe) {
        logger.error('Stripe is not configured. Please provide a STRIPE_SECRET_KEY in the environment variables.');
        return next(new Error('Payment processing is not available.'));
    }

    const { amount, creatorId } = req.body; // amount in dollars, creatorId to get currency

    if (!amount || amount <= 0) {
        res.status(400);
        return next(new Error('A valid amount is required.'));
    }

    try {
        let currency = 'usd'; // Default currency
        if (creatorId) {
            const creator = await User.findById(creatorId).select('currency');
            if (creator && creator.currency) {
                currency = creator.currency;
            }
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amount in cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true, // This is key for showing mobile money, etc.
            },
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        logger.error('Stripe Payment Intent creation failed:', error);
        next(new Error('Failed to initialize payment.'));
    }
};