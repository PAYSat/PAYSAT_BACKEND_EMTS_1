import Stripe from 'stripe';
import 'dotenv/config';

export const apiVersion = process.env.STRIPE_API_VERSION;
export const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion
});
