/**
 * Check Limit API
 * Validates if user can perform action based on subscription tier
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { getAuthenticatedUser } from '~/lib/auth/clerk.server';
import { UsageGuard } from '~/lib/billing/usage-guard.server';

export async function action(args: ActionFunctionArgs) {
  if (args.request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(args);
    const { action: actionType } = await args.request.json();

    if (!['create_project', 'create_screen', 'upload_file'].includes(actionType)) {
      return json({ error: 'Invalid action type' }, { status: 400 });
    }

    let result;
    switch (actionType) {
      case 'create_project':
        result = await UsageGuard.canCreateProject(user.clerkUserId);
        break;
      case 'create_screen':
        result = await UsageGuard.canCreateScreen(user.clerkUserId);
        break;
      case 'upload_file':
        result = await UsageGuard.canUploadFile(user.clerkUserId, 0);
        break;
      default:
        return json({ error: 'Unknown action' }, { status: 400 });
    }

    if (!result.allowed) {
      return json({
        allowed: false,
        error: result.error,
        current: result.current,
        max: result.max,
        unlimited: result.unlimited,
        upgradeRequired: true,
        showUpgradeButton: true,
        tier: user.subscriptionTier || 'free',
      }, { status: 403 });
    }

    return json({
      allowed: true,
      current: result.current,
      max: result.max,
      unlimited: result.unlimited,
    });
  } catch (error: any) {
    console.error('Error checking limit:', error);
    return json({
      error: 'Failed to check limit',
      details: error.message,
    }, { status: 500 });
  }
}
