/**
 * Usage Guard - Enforces subscription limits
 * Prevents users from exceeding their tier limits
 */

import { json } from '@remix-run/node';
import { billing } from './stripe.server';

export class UsageGuard {
  /**
   * Check if user can create a project
   */
  static async canCreateProject(clerkUserId: string) {
    const check = await billing.canPerformAction(clerkUserId, 'create_project');
    
    if (!check.allowed) {
      return {
        allowed: false,
        error: check.unlimited 
          ? 'Unlimited projects available'
          : `Project limit reached (${check.current}/${check.max}). Upgrade to create more projects.`,
        current: check.current,
        max: check.max,
        unlimited: check.unlimited,
      };
    }

    return { allowed: true, current: check.current, max: check.max, unlimited: check.unlimited };
  }

  /**
   * Check if user can create a screen
   */
  static async canCreateScreen(clerkUserId: string) {
    const check = await billing.canPerformAction(clerkUserId, 'create_screen');
    
    if (!check.allowed) {
      // Get user's current tier to suggest next tier
      const { db } = await import('~/lib/database/supabase.server');
      const user = await db.getUserByClerkId(clerkUserId);
      const currentTier = user.subscription_tier || 'free';
      
      // Suggest next tier
      const tierUpgrades = {
        free: { name: 'Indie Accelerator', price: '$5/mo', screens: 100 },
        pro: { name: 'Team Rocket', price: '$15/mo', screens: 1000 },
        enterprise: { name: 'Studio Dominator', price: '$30/mo', screens: 2000 },
      };
      
      const upgrade = tierUpgrades[currentTier];
      const upgradeMsg = upgrade 
        ? `Upgrade to ${upgrade.name} (${upgrade.price}) for ${upgrade.screens} screens/month.`
        : 'Upgrade your plan for more screens.';
      
      return {
        allowed: false,
        error: check.unlimited
          ? 'Unlimited screens available'
          : `You've reached your limit of ${check.max} screens/month. ${upgradeMsg}`,
        current: check.current,
        max: check.max,
        unlimited: check.unlimited,
      };
    }

    return { allowed: true, current: check.current, max: check.max, unlimited: check.unlimited };
  }

  /**
   * Check if user can upload file
   */
  static async canUploadFile(clerkUserId: string, fileSizeBytes: number) {
    const check = await billing.checkUsageLimit(clerkUserId, 'storage');
    const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
    const newTotal = check.current + fileSizeGB;

    if (newTotal > check.max) {
      return {
        allowed: false,
        error: `Storage limit exceeded. Would use ${newTotal.toFixed(2)}GB of ${check.max}GB. Upgrade for more storage.`,
        current: check.current,
        max: check.max,
        unlimited: check.unlimited,
      };
    }

    return { allowed: true, current: check.current, max: check.max, unlimited: check.unlimited };
  }

  /**
   * Enforce project creation limit (throws error response)
   */
  static async enforceProjectLimit(clerkUserId: string) {
    const check = await this.canCreateProject(clerkUserId);
    
    if (!check.allowed) {
      throw json({
        error: check.error,
        limitType: 'projects',
        current: check.current,
        max: check.max,
        upgradeRequired: true,
      }, { status: 403 });
    }

    return check;
  }

  /**
   * Enforce screen creation limit (throws error response)
   */
  static async enforceScreenLimit(clerkUserId: string) {
    const check = await this.canCreateScreen(clerkUserId);
    
    if (!check.allowed) {
      throw json({
        error: check.error,
        limitType: 'screens',
        current: check.current,
        max: check.max,
        upgradeRequired: true,
      }, { status: 403 });
    }

    return check;
  }

  /**
   * Enforce storage limit (throws error response)
   */
  static async enforceStorageLimit(clerkUserId: string, fileSizeBytes: number) {
    const check = await this.canUploadFile(clerkUserId, fileSizeBytes);
    
    if (!check.allowed) {
      throw json({
        error: check.error,
        limitType: 'storage',
        current: check.current,
        max: check.max,
        upgradeRequired: true,
      }, { status: 403 });
    }

    return check;
  }

  /**
   * Get user's current usage stats
   */
  static async getUserUsageStats(clerkUserId: string) {
    const [projects, screens, storage] = await Promise.all([
      billing.checkUsageLimit(clerkUserId, 'projects'),
      billing.checkUsageLimit(clerkUserId, 'screens'),
      billing.checkUsageLimit(clerkUserId, 'storage'),
    ]);

    return {
      projects: {
        current: projects.current,
        max: projects.max,
        unlimited: projects.unlimited,
        percentage: projects.unlimited ? 0 : Math.round((projects.current / projects.max) * 100),
        exceeded: projects.exceeded,
      },
      screens: {
        current: screens.current,
        max: screens.max,
        unlimited: screens.unlimited,
        percentage: screens.unlimited ? 0 : Math.round((screens.current / screens.max) * 100),
        exceeded: screens.exceeded,
      },
      storage: {
        current: storage.current,
        max: storage.max,
        unlimited: storage.unlimited,
        percentage: Math.round((storage.current / storage.max) * 100),
        exceeded: storage.exceeded,
      },
    };
  }
}
