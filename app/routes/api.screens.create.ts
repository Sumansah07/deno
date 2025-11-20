/**
 * API endpoint to create/track a screen
 * Increments user's screen count for usage tracking
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { getAuth } from '@clerk/remix/ssr.server';
import { db } from '~/lib/database/supabase.server';

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const { userId: clerkUserId } = await getAuth(request, context);

    if (!clerkUserId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, name, html, css, js, canvasPosition } = body;

    // Get user from database
    const user = await db.getUserByClerkId(clerkUserId);

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Check screen creation limit
    const limits = await db.getUserLimits(user.id);
    if (user.aiGenerationsCount >= limits.maxAiGenerations) {
      const tier = user.subscriptionTier || 'free';
      const tierUpgrades = {
        free: { name: 'Indie Accelerator', price: '$5/mo', screens: 100 },
        pro: { name: 'Team Rocket', price: '$15/mo', screens: 1000 },
        enterprise: { name: 'Studio Dominator', price: '$30/mo', screens: 2000 },
      };
      
      const upgrade = tierUpgrades[tier];
      const upgradeMsg = upgrade 
        ? `Upgrade to ${upgrade.name} (${upgrade.price}) for ${upgrade.screens} screens/month.`
        : 'Upgrade your plan for more screens.';
      
      return json(
        {
          error: true,
          message: `You've reached your limit of ${limits.maxAiGenerations} screens/month. ${upgradeMsg}`,
          limitReached: true,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Create screen in database
    const screen = await db.createScreen({
      projectId,
      name,
      htmlContent: html,
      cssContent: css,
      jsContent: js,
      canvasPosition: canvasPosition || { x: 0, y: 0 },
    });

    // Increment user's screen count (ai_generations_count)
    await db.incrementUsage(user.id, 'screen_created');

    return json({
      success: true,
      screen,
      screensCreated: user.aiGenerationsCount + 1,
    });
  } catch (error) {
    console.error('Error creating screen:', error);
    return json({ error: 'Failed to create screen' }, { status: 500 });
  }
}
