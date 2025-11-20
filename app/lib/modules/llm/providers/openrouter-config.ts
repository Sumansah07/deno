/**
 * OpenRouter Provider Configuration
 * Different models are hosted by different providers
 */

export interface OpenRouterProviderConfig {
  only?: string[];
  order?: string[];
}

export interface OpenRouterRequestBody {
  model: string;
  messages: any[];
  provider?: OpenRouterProviderConfig;
  [key: string]: any;
}

/**
 * Get provider configuration from environment variables
 */
export function getOpenRouterProviderConfig(
  model?: string,
  serverEnv?: Record<string, string>
): OpenRouterProviderConfig {
  // SPECIAL CASE: Kimi model has complete freedom - no provider restrictions
  if (model && model.includes('kimi')) {
    console.log(`🆓 OpenRouter [${model}]: FREE PROVIDER SELECTION (no restrictions)`);
    return {}; // Empty config = full freedom to choose any provider
  }
  
  // Check for Qwen-specific configuration
  if (model && model.includes('qwen')) {
    const qwenProviders = serverEnv?.OPENROUTER_QWEN_PROVIDERS?.split(',').map(p => p.trim().toLowerCase()) || ['chutes'];
    const qwenUseOnly = serverEnv?.OPENROUTER_QWEN_USE_ONLY !== 'false'; // Default to true
    
    const config = qwenUseOnly ? { only: qwenProviders } : { order: qwenProviders };
    console.log(`🔧 OpenRouter [${model}]:`, JSON.stringify(config));
    return config;
  }
  
  // For all other models, let OpenRouter choose the best provider automatically
  console.log(`🌐 OpenRouter [${model}]: AUTO PROVIDER SELECTION (no restrictions)`);
  return {}; // Empty config = OpenRouter decides best provider
}

/**
 * Add provider configuration to OpenRouter request body
 */
export function addProviderConfig(
  requestBody: any, 
  serverEnv?: Record<string, string>
): OpenRouterRequestBody {
  const providerConfig = getOpenRouterProviderConfig(requestBody.model, serverEnv);
  
  return {
    ...requestBody,
    provider: providerConfig
  };
}