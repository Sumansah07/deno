/**
 * Screen Persistence Service
 * Handles saving and loading canvas screens/designs to/from Supabase
 */

import { supabasePersistence } from './supabase-persistence';
import type { PageInfo } from '~/lib/stores/canvas';

export interface Screen {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  htmlContent: string;
  cssContent?: string;
  jsContent?: string;
  thumbnailUrl?: string;
  canvasPosition: { x: number; y: number };
  screenOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

class ScreenPersistenceService {
  // Track screens saved in this session to prevent duplicates
  private screensSavedInSession = new Set<string>();

  /**
   * Save a screen to Supabase (STRICT duplicate prevention)
   */
  async saveScreen(screen: Omit<Screen, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      await (supabasePersistence as any).ensureInitialized();
    } catch (error) {
      console.warn('❌ Failed to initialize Supabase:', error);
      throw new Error('Supabase not available');
    }

    const supabase = (supabasePersistence as any).supabase;
    const userContext = (supabasePersistence as any).userContext;

    if (!supabase || !userContext) {
      throw new Error('Supabase not initialized or user not authenticated');
    }

    // STRICT: Validate screen has content
    if (!screen.htmlContent || screen.htmlContent.trim().length === 0) {
      console.log('⏭️ Skipping screen save: No HTML content');
      throw new Error('Cannot save screen without HTML content');
    }

    // Create unique identifier for deduplication
    const screenKey = `${screen.projectId}:${screen.name}`;

    // Check session cache first to prevent duplicate API calls
    if (this.screensSavedInSession.has(screenKey)) {
      console.log(`⏭️ Screen already saved in this session: ${screen.name}`);
      // Return existing screen ID from database
      const { data: existingScreen } = await supabase
        .from('screens')
        .select('id')
        .eq('project_id', screen.projectId)
        .eq('name', screen.name)
        .single();
      
      if (existingScreen) {
        return existingScreen.id;
      }
    }

    // Check if screen already exists in database
    const { data: existingScreen } = await supabase
      .from('screens')
      .select('id')
      .eq('project_id', screen.projectId)
      .eq('name', screen.name)
      .single();

    // Only check limits for NEW screens (not updates)
    if (!existingScreen) {
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier, ai_generations_count')
        .eq('clerk_user_id', userContext.clerkUserId)
        .single();

      if (userData) {
        const { data: limits } = await supabase.rpc('get_user_limits', { user_id: userContext.userId });
        
        if (limits && userData.ai_generations_count >= limits.max_ai_generations) {
          const tier = userData.subscription_tier || 'free';
          const tierUpgrades = {
            free: { name: 'Indie Accelerator', price: '$5/mo', screens: 100 },
            pro: { name: 'Team Rocket', price: '$15/mo', screens: 1000 },
            enterprise: { name: 'Studio Dominator', price: '$30/mo', screens: 2000 },
          };
          
          const upgrade = tierUpgrades[tier];
          const upgradeMsg = upgrade 
            ? `Upgrade to ${upgrade.name} (${upgrade.price}) for ${upgrade.screens} screens/month.`
            : 'Upgrade your plan for more screens.';
          
          const error = new Error(`You've reached your limit of ${limits.max_ai_generations} screens/month. ${upgradeMsg}`);
          (error as any).limitReached = true;
          (error as any).upgradeRequired = true;
          throw error;
        }
      }
    }

    let screenId: string;

    if (existingScreen) {
      // Update existing screen instead of creating duplicate
      console.log(`🔄 Updating existing screen: ${screen.name}, HTML length: ${screen.htmlContent.length}`);
      const { error: updateError } = await supabase
        .from('screens')
        .update({
          html_content: screen.htmlContent,
          css_content: screen.cssContent,
          js_content: screen.jsContent,
          canvas_position: screen.canvasPosition,
          screen_order: screen.screenOrder,
        })
        .eq('id', existingScreen.id);

      if (updateError) {
        console.error('Failed to update screen:', updateError);
        throw updateError;
      }

      screenId = existingScreen.id;
    } else {
      // Create new screen
      console.log(`✨ Creating NEW screen: ${screen.name}, HTML length: ${screen.htmlContent.length}`);
      const { data, error } = await supabase
        .from('screens')
        .insert({
          project_id: screen.projectId,
          name: screen.name,
          description: screen.description,
          html_content: screen.htmlContent,
          css_content: screen.cssContent,
          js_content: screen.jsContent,
          thumbnail_url: screen.thumbnailUrl,
          canvas_position: screen.canvasPosition,
          screen_order: screen.screenOrder,
          generation_status: 'completed',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save screen:', error);
        throw error;
      }

      screenId = data.id;
      
      // Increment screen count for new screens only
      try {
        await supabase.rpc('increment_usage', {
          p_user_id: userContext.userId,
          p_usage_type: 'screen_created'
        });
      } catch (rpcError) {
        console.warn('⚠️ Could not increment usage (RPC may not exist):', rpcError);
        // Continue anyway - don't block screen save
      }
    }

    // Mark as saved in this session
    this.screensSavedInSession.add(screenKey);
    console.log(`✅ Screen saved to Supabase: ${screen.name} (ID: ${screenId})`);

    return screenId;
  }

  /**
   * Clear session cache (call when switching projects or starting new session)
   */
  clearSessionCache() {
    this.screensSavedInSession.clear();
    console.log('🧹 Cleared screen session cache');
  }

  /**
   * Update existing screen
   */
  async updateScreen(screenId: string, updates: Partial<Screen>): Promise<void> {
    try {
      await (supabasePersistence as any).ensureInitialized();
    } catch (error) {
      console.warn('❌ Failed to initialize Supabase:', error);
      throw new Error('Supabase not available');
    }

    const supabase = (supabasePersistence as any).supabase;

    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
      .from('screens')
      .update({
        name: updates.name,
        html_content: updates.htmlContent,
        css_content: updates.cssContent,
        js_content: updates.jsContent,
        canvas_position: updates.canvasPosition,
        screen_order: updates.screenOrder,
      })
      .eq('id', screenId);

    if (error) throw error;
  }

  /**
   * Load all screens for a project
   */
  async loadProjectScreens(projectId: string): Promise<Screen[]> {
    try {
      await (supabasePersistence as any).ensureInitialized();
    } catch (error) {
      console.warn('❌ Failed to initialize Supabase:', error);
      return [];
    }

    const supabase = (supabasePersistence as any).supabase;
    const userContext = (supabasePersistence as any).userContext;

    console.log('📊 Loading screens for project:', projectId);
    console.log('🔑 User context:', userContext ? 'SET' : 'NOT SET');

    if (!supabase || !userContext) {
      console.warn('❌ Cannot load screens: Supabase not initialized or user not authenticated');
      return [];
    }

    console.log('🔍 Executing Supabase query for screens...');
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('project_id', projectId)
      .order('screen_order', { ascending: true });

    if (error) {
      console.error('❌ Failed to load screens:', error);
      return [];
    }

    console.log('✅ Screens loaded from database:', {
      count: data?.length || 0,
      screens: data?.map((s) => ({ id: s.id, name: s.name })) || [],
    });

    return data.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      name: s.name || 'Untitled',
      description: s.description || undefined,
      htmlContent: s.html_content || '',
      cssContent: s.css_content || undefined,
      jsContent: s.js_content || undefined,
      thumbnailUrl: s.thumbnail_url || undefined,
      canvasPosition: s.canvas_position || { x: 0, y: 0 },
      screenOrder: s.screen_order || 0,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }

  /**
   * Delete a screen
   */
  async deleteScreen(screenId: string): Promise<void> {
    try {
      await (supabasePersistence as any).ensureInitialized();
    } catch (error) {
      console.warn('❌ Failed to initialize Supabase:', error);
      throw new Error('Supabase not available');
    }

    const supabase = (supabasePersistence as any).supabase;

    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase.from('screens').delete().eq('id', screenId);

    if (error) throw error;
  }

  /**
   * Get screen count for a project
   */
  async getScreenCount(projectId: string): Promise<number> {
    try {
      await (supabasePersistence as any).ensureInitialized();
    } catch (error) {
      console.warn('❌ Failed to initialize Supabase:', error);
      return 0;
    }

    const supabase = (supabasePersistence as any).supabase;

    if (!supabase) return 0;

    const { count, error } = await supabase
      .from('screens')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) return 0;
    return count || 0;
  }
}

export const screenPersistence = new ScreenPersistenceService();
