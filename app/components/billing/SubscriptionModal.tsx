/**
 * Subscription Modal Component
 * Handles subscription upgrades and billing management
 */

import React, { useState } from 'react';
import { useAuthContext } from '~/lib/auth/auth-provider';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: 'free' | 'pro' | 'enterprise';
}

export function SubscriptionModal({ isOpen, onClose, currentTier = 'free' }: SubscriptionModalProps) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  if (!isOpen) return null;

  const plans = {
    free: {
      name: 'Zero-Risk',
      price: '$0',
      period: 'forever',
      savings: '',
      features: [
        '5 projects',
        '10 screens/month',
        '$0.0/screen',
        '1 GB storage',
        'Basic support',
      ],
      current: currentTier === 'free',
      order: 1,
    },
    pro: {
      name: 'Indie Accelerator',
      price: '$5',
      annualPrice: '$48',
      period: 'per month',
      savings: 'Save 20% annually',
      savingsDetail: 'vs $0.05/screen',
      features: [
        '20 projects',
        '100 screens/month',
        '$0.05/screen',
        '10 Figma export',
        'Priority support',
        '5 GB storage',
        'Advanced AI models',
      ],
      current: currentTier === 'pro',
      order: 2,
    },
    enterprise: {
      name: 'Team Rocket',
      price: '$15',
      annualPrice: '$144',
      period: 'per month',
      savings: 'Save 20% annually',
      savingsDetail: '70% cheaper per screen',
      popular: true,
      features: [
        '100 projects',
        '1000 screens/month',
        '$0.015/screen',
        '100 Figma export',
        'Custom integrations',
        'Advanced AI models',
        '10 GB storage',
        'Team collaboration',
        'SSO integration',
      ],
      current: currentTier === 'enterprise',
      order: 3,
    },
    enterprisePlus: {
      name: 'Studio Dominator',
      price: '$30',
      annualPrice: '$288',
      period: 'per month',
      savings: 'Save 20% annually',
      savingsDetail: '70% cheaper per screen',
      features: [
        '200 projects',
        '2000 screens/month',
        '$0.015/screen',
        '300 Figma export',
        'Custom integrations',
        
        'Dedicated support',
        '20 GB storage',
        'Team collaboration',
        'SSO integration',
      ],
      contactUs: true,
      current: currentTier === 'enterprise_plus',
      order: 4,
    },
  };

  const planOrder = ['free', 'pro', 'enterprise', 'enterprisePlus'];

  const handleUpgrade = async (plan: 'pro' | 'enterprise' | 'enterprisePlus') => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          clerkUserId: user.clerkUserId,
        }),
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        window.location.href = checkoutUrl;
      } else {
        const error = await response.json();
        console.error('Checkout error:', error);
        alert(`${error.error || 'Failed to create checkout session'}${error.details ? '\n\nDetails: ' + error.details : ''}`);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to start upgrade process');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/billing/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: user.clerkUserId,
        }),
      });

      if (response.ok) {
        const { portalUrl } = await response.json();
        window.location.href = portalUrl;
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to open billing portal');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert('Failed to open billing management');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        {/* Urgency Banner */}
        {/* <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-center py-3 px-4">
          <p className="text-sm font-semibold">🔥 Limited Time: Save 20% on Annual Plans - Lock in Today's Pricing!</p>
        </div> */}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
          <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">
            Choose Your Plan
          </h2>
          <button
            onClick={onClose}
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            <div className="i-ph:x text-2xl" />
          </button>
        </div>

        {/* Billing Toggle */}
        {/* <div className="flex justify-center items-center gap-4 py-4">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-bolt-elements-textPrimary font-semibold' : 'text-bolt-elements-textSecondary'}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-14 h-7 bg-bolt-elements-background-depth-3 rounded-full transition-colors"
          >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-blue-600 rounded-full transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
          </button>
          <span className={`text-sm ${billingCycle === 'annual' ? 'text-bolt-elements-textPrimary font-semibold' : 'text-bolt-elements-textSecondary'}`}>
            Annual <span className="text-green-600 font-bold">Save 20%</span>
          </span>
        </div> */}

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {planOrder.map((key) => {
              const plan = plans[key];
              const isPopular = plan.popular && !plan.current;
              const displayPrice = billingCycle === 'annual' && plan.annualPrice ? plan.annualPrice : plan.price;
              
              return (
                <div
                  key={key}
                  className={`relative rounded-lg border-2 p-6 transition-all ${
                    plan.current
                      ? 'border-green-500 bg-bolt-elements-background-depth-2'
                      : isPopular
                      ? 'border-blue-500 bg-gradient-to-br from-blue-900/20 to-purple-900/20 shadow-lg scale-105'
                      : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg whitespace-nowrap">
                        🚀 Most Popular
                      </span>
                    </div>
                  )}

                  {plan.current && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-bolt-elements-textPrimary mb-2">
                      {plan.name}
                    </h3>
                    <div className="mb-2">
                      <span className="text-4xl font-bold text-bolt-elements-textPrimary">
                        {displayPrice}
                      </span>
                      <span className="text-bolt-elements-textSecondary ml-1 text-sm">
                        {key === 'free' ? plan.period : billingCycle === 'annual' ? '/year' : '/month'}
                      </span>
                    </div>
                    {billingCycle === 'annual' && plan.savings && key !== 'free' && (
                      <p className="text-green-600 text-xs font-semibold">{plan.savings}</p>
                    )}
                    {plan.savingsDetail && key !== 'free' && (
                      <p className="text-blue-400 text-xs mt-1">{plan.savingsDetail}</p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <div className="i-ph:check text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-bolt-elements-textSecondary">{feature}</span>
                      </li>
                    ))}
                    {plan.contactUs && (
                      <li className="flex items-start text-sm">
                        <div className="i-ph:check text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                        <a href="mailto:elarica2710@gmail.com" className="text-blue-500 hover:underline">
                          Contact Us
                        </a>
                      </li>
                    )}
                  </ul>

                  <div className="mt-auto">
                    {plan.current ? (
                      <div className="space-y-2">
                        <button
                          disabled
                          className="w-full bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border border-bolt-elements-borderColor py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Current Plan
                        </button>
                        {key !== 'free' && (
                          <button
                            onClick={handleManageBilling}
                            disabled={loading}
                            className="w-full bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            {loading ? <LoadingSpinner size="sm" /> : 'Manage Billing'}
                          </button>
                        )}
                      </div>
                    ) : key === 'free' ? (
                      <button
                        disabled
                        className="w-full bg-gray-400 text-white py-3 px-4 rounded-lg font-medium cursor-not-allowed opacity-50"
                      >
                        Downgrade Not Available
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(key as 'pro' | 'enterprise' | 'enterprisePlus')}
                        disabled={loading}
                        className="w-full bg-black hover:bg-gray-900 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {loading ? <LoadingSpinner size="sm" /> : `Upgrade Now`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center text-sm text-bolt-elements-textSecondary">
            <p className="font-semibold text-bolt-elements-textPrimary">✨ All plans include instant access. Cancel anytime.</p>
            <p className="mt-2">
              Need enterprise solutions?{' '}
              <a href="mailto:elarica2710@gmail.com" className="text-blue-500 hover:underline font-semibold">
                Contact us for custom pricing
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
