/**
 * Stripe Billing Service
 * Handles subscription creation, management, and billing portal
 */

import Stripe from 'stripe';
import { db } from '~/lib/database/supabase.server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
});

export class BillingService {
  /**
   * Create a new Stripe customer
   */
  async createCustomer(email: string, clerkUserId: string, name?: string): Promise<Stripe.Customer> {
    return stripe.customers.create({
      email,
      name,
      metadata: {
        clerk_user_id: clerkUserId,
      },
    });
  }

  /**
   * Get or create Stripe customer for user
   */
  async getOrCreateCustomer(clerkUserId: string): Promise<string> {
    // Check if user already has a Stripe customer ID
    const user = await db.getUserByClerkId(clerkUserId);

    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    // Create new customer
    const customer = await this.createCustomer(user.email, clerkUserId, user.full_name || undefined);

    // Update user with Stripe customer ID
    await db.updateUserSubscription(clerkUserId, {
      tier: user.subscription_tier,
      status: user.subscription_status,
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(clerkUserId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const customerId = await this.getOrCreateCustomer(clerkUserId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId,
        },
      },
      metadata: {
        clerk_user_id: clerkUserId,
      },
    });

    return session;
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(clerkUserId: string, returnUrl: string) {
    try {
      const user = await db.getUserByClerkId(clerkUserId);
      
      // Get customer ID from database or find by email
      let customerId = user.stripe_customer_id;
      
      if (!customerId) {
        // Try to find customer by email
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          // Update database with customer ID
          await db.updateUserSubscription(clerkUserId, {
            tier: user.subscription_tier,
            status: user.subscription_status,
            stripeCustomerId: customerId,
          });
        } else {
          throw new Error('No Stripe customer found. Please complete a purchase first.');
        }
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session;
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, atPeriodEnd = true) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: atPeriodEnd,
    });
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: string) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string) {
    return stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
  }

  /**
   * Get upcoming invoice
   */
  async getUpcomingInvoice(customerId: string) {
    try {
      return await stripe.invoices.retrieveUpcoming({
        customer: customerId,
      });
    } catch (error) {
      // No upcoming invoice
      return null;
    }
  }

  /**
   * Get payment methods for customer
   */
  async getPaymentMethods(customerId: string) {
    return stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
  }

  /**
   * Update subscription to new price
   */
  async updateSubscriptionPrice(subscriptionId: string, newPriceId: string) {
    const subscription = await this.getSubscription(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    return stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });
  }

  /**
   * Create usage record for metered billing
   */
  async recordUsage(subscriptionItemId: string, quantity: number, timestamp?: number) {
    return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }

  /**
   * Validate subscription tier
   */
  static isValidTier(tier: string): tier is 'free' | 'pro' | 'enterprise' | 'enterprise_plus' {
    return ['free', 'pro', 'enterprise', 'enterprise_plus'].includes(tier);
  }

  /**
   * Get subscription tier pricing and limits
   */
  static getPricing() {
    return {
      free: {
        name: 'Zero-Risk',
        price: 0,
        priceId: process.env.STRIPE_PRICE_ID_FREE,
        limits: { projects: 5, screens: 10, storage_gb: 1, price_per_screen: 0 },
        features: ['5 projects', '10 screens/month', '$0.0/screen', '1 GB storage', 'Basic support'],
      },
      pro: {
        name: 'Indie Accelerator',
        price: 5.99,
        priceId: process.env.STRIPE_PRICE_ID_PRO,
        limits: { projects: 20, screens: 100, storage_gb: 10, price_per_screen: 0.059 },
        features: ['20 projects', '100 screens/month', '$0.059/screen', '10 GB storage', 'Figma export'],
      },
      enterprise: {
        name: 'Team Rocket',
        price: 18.99,
        priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE,
        limits: { projects: 100, screens: 1000, storage_gb: 100, price_per_screen: 0.018 },
        features: ['100 projects', '1000 screens/month', '$0.018/screen', '100 GB storage', 'Team collaboration'],
      },
      enterprise_plus: {
        name: 'Studio Dominator',
        price: 49.99,
        priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE_PLUS,
        limits: { projects: 200, screens: 2000, storage_gb: 500, price_per_screen: 0.049 },
        features: ['200 projects', '2000 screens/month', '$0.049/screen', '500 GB storage', 'Contact Us'],
      },
    };
  }

  static getTierLimits(tier: 'free' | 'pro' | 'enterprise' | 'enterprise_plus') {
    const pricing = this.getPricing();
    return pricing[tier]?.limits || pricing.free.limits;
  }

  /**
   * Check if user has reached usage limit
   */
  async checkUsageLimit(clerkUserId: string, limitType: 'projects' | 'screens' | 'storage') {
    const user = await db.getUserByClerkId(clerkUserId);
    const tier = user.subscription_tier || 'free';
    const limits = BillingService.getTierLimits(tier as 'free' | 'pro' | 'enterprise' | 'enterprise_plus');

    switch (limitType) {
      case 'projects': {
        const projectCount = await db.getUserProjects(user.id, 1000, 0);
        const current = Array.isArray(projectCount) ? projectCount.length : 0;
        const max = limits.projects;
        return {
          exceeded: max !== -1 && current >= max,
          current,
          max,
          unlimited: max === -1,
        };
      }
      case 'screens': {
        const current = await db.getUserScreenCount(user.id);
        const max = limits.screens;
        return {
          exceeded: max !== -1 && current >= max,
          current,
          max,
          unlimited: max === -1,
        };
      }
      case 'storage': {
        const storageGB = (user.storage_used_bytes || 0) / (1024 * 1024 * 1024);
        const current = parseFloat(storageGB.toFixed(2));
        const max = limits.storage_gb;
        return {
          exceeded: current >= max,
          current,
          max,
          unlimited: false,
        };
      }
      default:
        return { exceeded: false, current: 0, max: 0, unlimited: false };
    }
  }

  /**
   * Check if user can perform action based on limits
   */
  async canPerformAction(clerkUserId: string, action: 'create_project' | 'create_screen' | 'upload_file') {
    const limitType = action === 'create_project' ? 'projects' : action === 'create_screen' ? 'screens' : 'storage';
    const limitCheck = await this.checkUsageLimit(clerkUserId, limitType);
    
    return {
      allowed: !limitCheck.exceeded,
      ...limitCheck,
    };
  }
}

// Export singleton instance
export const billing = new BillingService();
