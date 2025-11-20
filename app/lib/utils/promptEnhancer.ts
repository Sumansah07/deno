/**
 * Background Prompt Enhancement Service
 * Uses n8n context-aware system to enrich prompts with design references
 * Works silently - no changes to chat UI, just better context for AI
 */

import type { DesignReference } from './contextAwareGeneration';

interface EnhancementResult {
  enhancedPrompt: string;
  originalPrompt: string;
  referencesUsed: number;
  contextAdded: boolean;
}

/**
 * Fetches design context from n8n workflow in background
 * Returns enhanced prompt with hidden context for better AI generation
 */
export async function enhancePromptWithContext(
  userPrompt: string,
  options?: {
    maxReferences?: number;
    timeout?: number;
  },
): Promise<EnhancementResult> {
  const maxReferences = options?.maxReferences || 3;
  const timeout = options?.timeout || 5000; // 5 second timeout

  console.log('🔍 Fetching design context in background...');

  try {
    // Call n8n with timeout to get references
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('/api/generate-mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        options: { maxScreens: maxReferences },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result: any = await response.json();

      if (result.success && result.references && result.references.length > 0) {
        const dbRefs = result.references.filter((r: any) => r.type === 'database');
        
        if (dbRefs.length > 0) {
          console.log(`✅ Got ${dbRefs.length} design references for context`);

          // Pass actual screen analysis from database to AI
          const contextHints = dbRefs
            .map((ref: any, idx: number) => {
              return `\n--- REFERENCE ${idx + 1} [${ref.similarity}] ---\nScreen: ${ref.screen || 'N/A'}\nCategory: ${ref.category || 'Unknown'}\n\nDesign Analysis:\n${ref.analysis || 'No analysis available'}\n`;
            })
            .join('\n');

          // Enhance the prompt with real database context (invisible to user)
          const enhancedPrompt = `${userPrompt}

<design_context>
Use these real design examples as reference for building a high-quality UI:
${contextHints}
</design_context>`;

          return {
            enhancedPrompt,
            originalPrompt: userPrompt,
            referencesUsed: dbRefs.length,
            contextAdded: true,
          };
        }
      }
    }

    console.log('ℹ️ No context available, using original prompt');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Context fetch timeout, proceeding with original prompt');
    } else {
      console.log('ℹ️ Context fetch failed, proceeding with original prompt');
    }
  }

  // Return original prompt if context fetch fails or times out
  return {
    enhancedPrompt: userPrompt,
    originalPrompt: userPrompt,
    referencesUsed: 0,
    contextAdded: false,
  };
}

/**
 * Checks if prompt would benefit from design context
 */
export function shouldEnhancePrompt(prompt: string): boolean {
  const designKeywords = [
    'create',
    'design',
    'build',
    'make',
    'generate',
    'mockup',
    'screen',
    'page',
    'interface',
    'checkout',
    'menu',
    'landing',
    'dashboard',
    'profile',
  ];

  const lowerPrompt = prompt.toLowerCase();

  return designKeywords.some((keyword) => lowerPrompt.includes(keyword));
}

/**
 * Background enhancement - non-blocking
 * Returns immediately with original prompt, enhances in background
 */
export async function tryEnhancePrompt(prompt: string): Promise<string> {
  // Quick check if enhancement would be useful
  if (!shouldEnhancePrompt(prompt)) {
    return prompt;
  }

  // Try to enhance with short timeout
  const result = await enhancePromptWithContext(prompt, {
    maxReferences: 3,
    timeout: 50000, // 6 second max wait for n8n
  });

  if (result.contextAdded) {
    console.log(`🎨 Prompt enhanced with ${result.referencesUsed} design patterns`);
  }

  return result.enhancedPrompt;
}
