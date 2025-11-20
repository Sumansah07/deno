/**
 * Usage Stats API
 * Returns current usage statistics for authenticated user
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { getAuthenticatedUser } from '~/lib/auth/clerk.server';
import { UsageGuard } from '~/lib/billing/usage-guard.server';

export async function loader(args: LoaderFunctionArgs) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(args);

    // Get usage stats
    const stats = await UsageGuard.getUserUsageStats(user.clerkUserId);

    return json({
      success: true,
      stats,
      tier: user.subscriptionTier || 'free',
    });
  } catch (error: any) {
    console.error('Error fetching usage stats:', error);
    return json({
      error: 'Failed to fetch usage statistics',
      details: error.message,
    }, { status: 500 });
  }
}
