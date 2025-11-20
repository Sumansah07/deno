import { type ActionFunctionArgs } from '@remix-run/node';
import { generateId } from 'ai';
import type { Message } from 'ai';
import { FALLBACK_CHAIN, getDefaultModel, getNextFallback, shouldRetry } from '~/lib/.server/llm/model-fallback';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

export async function loader() {
  return new Response('Method not allowed', { status: 405 });
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  // Import server-only modules inside the function to avoid client bundling
  const { generateText } = await import('~/lib/.server/llm/generate-text');
  const { createScopedLogger } = await import('~/utils/logger');
  const { getFilePaths, selectContext } = await import('~/lib/.server/llm/select-context');
  const { WORK_DIR } = await import('~/utils/constants');
  const { createSummary } = await import('~/lib/.server/llm/create-summary');
  const { MCPService } = await import('~/lib/services/mcpService');
  const { requireAuth, getAuthenticatedUser } = await import('~/lib/auth/clerk.server');
  
  const logger = createScopedLogger('api.chat-nonstream');

  const userId = await requireAuth({ context, request, params: {} });
  logger.info(`Chat request from authenticated user: ${userId}`);

  let userSubscriptionTier = 'free';
  let userSupabaseId: string | null = null;
  try {
    const user = await getAuthenticatedUser({ context, request, params: {} });
    userSubscriptionTier = user.subscriptionTier;
    userSupabaseId = user.supabaseUserId;
    logger.info(`✅ User authenticated - Clerk ID: ${userId}, Supabase ID: ${userSupabaseId}, Tier: ${userSubscriptionTier}`);
    
    const { canPerformAction } = await import('~/lib/services/usage-analytics.server');
    const canGenerate = await canPerformAction(userId, 'ai_generation');
    
    if (!canGenerate.allowed) {
      logger.warn(`❌ AI generation limit reached for user ${userId}`);
      return new Response(
        JSON.stringify({
          error: true,
          message: canGenerate.reason || 'AI generation limit reached',
          limitReached: true,
          upgradeRequired: true,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    logger.info(`✅ Usage check passed for user ${userId}`);
  } catch (error) {
    logger.error('❌ Error fetching user details:', error);
  }

  const { messages, files, promptId, contextOptimization, supabase, chatMode, designScheme, maxLLMSteps, useKimiPlanning, requestedModel, requestedProvider } =
    await request.json<{
      messages: Message[];
      files: any;
      promptId?: string;
      contextOptimization: boolean;
      chatMode: 'discuss' | 'build';
      designScheme?: any;
      supabase?: {
        isConnected: boolean;
        hasSelectedProject: boolean;
        credentials?: {
          anonKey?: string;
          supabaseUrl?: string;
        };
      };
      maxLLMSteps: number;
      useKimiPlanning?: boolean;
      requestedModel?: string;
      requestedProvider?: string;
    }>();

  // Use default model if none specified
  const defaultFallback = getDefaultModel();
  let currentModel = requestedModel || defaultFallback.model;
  let currentProvider = requestedProvider || defaultFallback.provider;
  let retryCount = 0;

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, any> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  // Two-stage AI pipeline: Kimi plans, then builder AI implements
  let enhancedMessages = messages;
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
  const kimiEnabled = useKimiPlanning !== false; // Default: enabled
  
  logger.info(`🎯 Kimi Check: chatMode=${chatMode}, hasLastMessage=${!!lastUserMessage}, useKimiPlanning=${useKimiPlanning}, kimiEnabled=${kimiEnabled}`);
  
  if (chatMode === 'build' && lastUserMessage && kimiEnabled) {
    logger.info('✅ All conditions met, starting Kimi planning...');
    try {
      logger.info('🧠 Stage 1: Kimi planning phase started');
      
      // Extract clean content without [Model:] and [Provider:] tags
      const { extractPropertiesFromMessage } = await import('~/lib/.server/llm/utils');
      const { content: cleanContent } = extractPropertiesFromMessage(lastUserMessage);
      
      logger.info(`📝 Clean user request: ${cleanContent}`);
      
      const planningPrompt = `You are a creative design consultant providing inspiration and suggestions for mobile app design.\n\nUser Request: ${cleanContent}\n\nProvide creative design suggestions including:\n\n1. **Suggested Screens** (8-12 screens that would make this app complete)\n2. **Color Palette Ideas** (suggest 2-3 beautiful color schemes with hex codes)\n3. **Typography Suggestions** (font pairings and sizes)\n4. **Layout Patterns** (modern mobile UI patterns that would work well)\n5. **Visual Style** (design philosophy - minimal, bold, playful, etc.)\n6. **Key Features** (unique features that would make this app stand out)\n\nKeep it concise and inspirational - these are suggestions to enhance creativity, not rigid requirements.`;

      const { generateText } = await import('~/lib/.server/llm/generate-text');
      const planningResult = await generateText({
        messages: [{ id: generateId(), role: 'user', content: planningPrompt }],
        env: process.env,
        options: { 
          toolChoice: 'none',
          maxTokens: 50000
        },
        apiKeys,
        files: {},
        providerSettings,
        promptId,
        contextOptimization: false,
        chatMode: 'discuss',
        forceModel: 'moonshotai/kimi-k2-thinking',
        forceProvider: 'OpenRouter',
      });

      logger.info(`🔍 Kimi result keys: ${Object.keys(planningResult).join(', ')}`);
      logger.info(`🔍 Result.text: "${planningResult.text}"`);
      logger.info(`🔍 Result.reasoning: "${planningResult.reasoning?.substring(0, 200)}..."`);
      logger.info(`🔍 Result.finishReason: ${planningResult.finishReason}`);
      logger.info(`🔍 Result.usage: ${JSON.stringify(planningResult.usage)}`);
      
      // Kimi returns response in reasoning field, not text field
      const designPlan = planningResult.reasoning || planningResult.text;
      
      if (!designPlan || designPlan.length === 0) {
        logger.error('❌ Kimi returned empty response, skipping planning');
        throw new Error('Empty Kimi response');
      }
      
      logger.info(`✅ Kimi planning complete: ${designPlan.length} chars`);
      logger.info(`📋 Kimi response preview: ${designPlan.substring(0, 500)}...`);
      
      // Format exactly like manual paste: [Model: xxx]\n\n[Provider: xxx]\n\n<content>
      const formattedPrompt = `[Model: ${currentModel}]\n\n[Provider: ${currentProvider}]\n\n${designPlan}`;
      
      logger.info(`📤 Formatted prompt preview (first 500 chars): ${formattedPrompt.substring(0, 50000)}`);
      
      enhancedMessages = [
        ...messages.slice(0, -1),
        {
          id: generateId(),
          role: 'user',
          content: formattedPrompt
        }
      ];
      
      logger.info('🚀 Stage 2: Builder AI implementation phase starting');
    } catch (error) {
      logger.error('❌ Kimi planning failed, proceeding without plan:', error);
    }
  }

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = enhancedMessages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length} words`);
    logger.info(`📨 Sending ${enhancedMessages.length} messages to builder AI`);

    const filePaths = getFilePaths(files || {});
    let filteredFiles: any = undefined;
    let summary: string | undefined = undefined;
    let messageSliceId = 0;

    const processedMessages = await mcpService.processToolInvocations(enhancedMessages, null);

    if (processedMessages.length > 3) {
      messageSliceId = processedMessages.length - 3;
    }

    if (filePaths.length > 0 && contextOptimization) {
      logger.debug('Generating Chat Summary');

      summary = await createSummary({
        messages: [...processedMessages],
        env: process.env,
        apiKeys,
        providerSettings,
        promptId,
        contextOptimization,
        onFinish(resp) {
          if (resp.usage) {
            logger.debug('createSummary token usage', JSON.stringify(resp.usage));
            cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
            cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
            cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
          }
        },
      });

      logger.debug('Updating Context Buffer');

      filteredFiles = await selectContext({
        messages: [...processedMessages],
        env: process.env,
        apiKeys,
        files,
        providerSettings,
        promptId,
        contextOptimization,
        summary,
        onFinish(resp) {
          if (resp.usage) {
            logger.debug('selectContext token usage', JSON.stringify(resp.usage));
            cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
            cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
            cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
          }
        },
      });

      if (filteredFiles) {
        logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
      }
    }

    const options: any = {
      supabaseConnection: supabase,
      toolChoice: 'auto',
      tools: mcpService.toolsWithoutExecute,
      maxSteps: maxLLMSteps,
    };

    logger.info('Generating complete response (non-streaming)');

    let result;
    let lastError;
    
    // Try current model with retries, then fallback chain
    while (true) {
      const fallbackConfig = FALLBACK_CHAIN().find(f => f.model === currentModel);
      const maxRetries = fallbackConfig?.maxRetries || 2;
      
      logger.info(`🎯 Attempting generation with ${currentModel} (${currentProvider})`);
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          result = await generateText({
            messages: enhancedMessages.length > messages.length ? [...enhancedMessages] : [...processedMessages],
            env: process.env,
            options,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            contextFiles: filteredFiles,
            chatMode,
            designScheme,
            summary,
            messageSliceId,
            forceModel: currentModel,
            forceProvider: currentProvider,
          });
          logger.info(`✅ Generation successful with ${currentModel}`);
          break;
        } catch (error: any) {
          lastError = error;
          if (shouldRetry(error, attempt, currentModel) && attempt < maxRetries) {
            logger.warn(`⚠️ ${currentModel} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            logger.error(`❌ ${currentModel} failed after ${attempt + 1} attempts`);
            break;
          }
        }
      }
      
      if (result) break;
      
      // Try next fallback
      const nextFallback = getNextFallback(currentModel);
      if (!nextFallback) {
        logger.error('❌ All fallback models exhausted');
        throw lastError || new Error('All models failed');
      }
      
      logger.info(`🔄 Switching to fallback: ${nextFallback.model} (${nextFallback.provider})`);
      currentModel = nextFallback.model;
      currentProvider = nextFallback.provider;
    }

    if (result.usage) {
      cumulativeUsage.completionTokens += result.usage.completionTokens || 0;
      cumulativeUsage.promptTokens += result.usage.promptTokens || 0;
      cumulativeUsage.totalTokens += result.usage.totalTokens || 0;
    }

    logger.info(`📊 Attempting to track usage - Supabase ID: ${userSupabaseId}, Tokens: ${cumulativeUsage.totalTokens}`);
    if (userSupabaseId) {
      try {
        const { db } = await import('~/lib/database/supabase.server');
        await db.incrementUsage(
          userSupabaseId,
          'ai_generation',
          cumulativeUsage.totalTokens,
          0
        );
        logger.info(`✅ Successfully tracked AI generation for user ${userId} - Tokens: ${cumulativeUsage.totalTokens}`);
      } catch (error) {
        logger.error('❌ Failed to track AI generation usage:', error);
      }
    }

    const contextFiles = filteredFiles
      ? Object.keys(filteredFiles).map((key) => {
          let path = key;
          if (path.startsWith(WORK_DIR)) {
            path = path.replace(WORK_DIR, '');
          }
          return path;
        })
      : [];

    return new Response(
      JSON.stringify({
        id: generateId(),
        content: result.text,
        role: 'assistant',
        usage: {
          completionTokens: cumulativeUsage.completionTokens,
          promptTokens: cumulativeUsage.promptTokens,
          totalTokens: cumulativeUsage.totalTokens,
        },
        contextFiles,
        summary,
        toolCalls: result.toolCalls || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    logger.error('Generation error:', error);
    
    // Better error message for pattern validation errors
    let errorMessage = error.message || 'An unexpected error occurred';
    if (errorMessage.includes('did not match') || errorMessage.includes('pattern')) {
      errorMessage = 'AI returned invalid format. Please try again or simplify your request.';
      logger.error('❌ JSON validation error - AI returned malformed response');
    }

    const errorResponse = {
      error: true,
      message: errorMessage,
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false,
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
