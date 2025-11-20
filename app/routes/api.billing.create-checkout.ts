/**
 * Stripe Checkout Creation API
 * Creates a Stripe checkout session for subscription upgrades
 */

import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '~/lib/auth/clerk.server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

export async function action(args: ActionFunctionArgs) {
  console.log('🔵 Create checkout endpoint called');
  
  if (args.request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(args);
    console.log('👤 User authenticated:', user.email);
    
    // Parse request body
    const { plan } = await args.request.json();
    console.log('📦 Plan selected:', plan);

    if (!plan || !['pro', 'enterprise', 'enterprisePlus'].includes(plan)) {
      console.error('❌ Invalid plan:', plan);
      return json({ error: 'Invalid plan selected. Must be pro, enterprise, or enterprisePlus.' }, { status: 400 });
    }

    // Check if user already has this tier or higher
    const { db } = await import('~/lib/database/supabase.server');
    try {
      const currentUser = await db.getUserByClerkId(user.clerkUserId);
      const tierOrder = { free: 0, pro: 1, enterprise: 2, enterprise_plus: 3 };
      const planToTier = { pro: 'pro', enterprise: 'enterprise', enterprisePlus: 'enterprise_plus' };
      const currentTierLevel = tierOrder[currentUser.subscription_tier || 'free'];
      const requestedTierLevel = tierOrder[planToTier[plan]];

      if (currentTierLevel >= requestedTierLevel) {
        return json({ error: 'You already have this plan or a higher tier.' }, { status: 400 });
      }
    } catch (error) {
      console.warn('Could not check current tier:', error);
    }

    // Get price ID from environment with validation
    const priceId = plan === 'pro' 
      ? process.env.STRIPE_PRICE_ID_PRO 
      : plan === 'enterprise'
      ? process.env.STRIPE_PRICE_ID_ENTERPRISE
      : plan === 'enterprisePlus'
      ? process.env.STRIPE_PRICE_ID_ENTERPRISE_PLUS
      : null;

    console.log('💰 Price ID for', plan, ':', priceId);

    if (!priceId) {
      console.error('❌ Price ID not configured for plan:', plan);
      return json({ 
        error: 'Subscription plan not configured', 
        details: `Missing STRIPE_PRICE_ID_${plan.toUpperCase()} in environment variables`
      }, { status: 500 });
    }

    // Create or get Stripe customer
    let customerId: string;
    
    try {
      // Try to find existing customer
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName || undefined,
          metadata: {
            clerk_user_id: user.clerkUserId,
          },
        });
        customerId = customer.id;
      }
    } catch (error) {
      console.error('Error managing Stripe customer:', error);
      return json({ error: 'Failed to create customer' }, { status: 500 });
    }

    console.log('🔨 Creating Stripe checkout session...');
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${new URL(args.request.url).origin}/dashboard?upgrade=success`,
      cancel_url: `${new URL(args.request.url).origin}/dashboard?upgrade=cancelled`,
      metadata: {
        clerk_user_id: user.clerkUserId,
        plan,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: user.clerkUserId,
          plan,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    console.log('✅ Checkout session created:', session.id);
    return json({ checkoutUrl: session.url });
  } catch (error: any) {
    console.error('❌ Error creating checkout session:', error);
    console.error('Error details:', error.message);
    return json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    }, { status: 500 });
  }
}
