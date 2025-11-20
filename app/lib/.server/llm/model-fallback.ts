// Automatic model fallback system - Configurable via .env
// Change model priority by setting these environment variables:
// PRIMARY_MODEL=qwen/qwen3-coder
// PRIMARY_PROVIDER=OpenRouter
// FALLBACK_MODEL_1=gemini-2.5-flash
// FALLBACK_PROVIDER_1=Google
// FALLBACK_MODEL_2=x-ai/grok-4-fast
// FALLBACK_PROVIDER_2=OpenRouter

let _fallbackChain: Array<{ model: string; provider: string; maxRetries: number }> | null = null;

function getFallbackChain() {
  if (_fallbackChain) return _fallbackChain;
  
  const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'qwen/qwen3-coder';
  const PRIMARY_PROVIDER = process.env.PRIMARY_PROVIDER || 'OpenRouter';
  const FALLBACK_MODEL_1 = process.env.FALLBACK_MODEL_1 || 'gemini-2.5-flash';
  const FALLBACK_PROVIDER_1 = process.env.FALLBACK_PROVIDER_1 || 'OpenRouter';
  const FALLBACK_MODEL_2 = process.env.FALLBACK_MODEL_2 || 'x-ai/grok-4-fast';
  const FALLBACK_PROVIDER_2 = process.env.FALLBACK_PROVIDER_2 || 'OpenRouter';
  const FALLBACK_MODEL_3 = process.env.FALLBACK_MODEL_3 || 'qwen/qwen3-coder-480b-a35b-instruct';
  const FALLBACK_PROVIDER_3 = process.env.FALLBACK_PROVIDER_3 || 'Novita';

  _fallbackChain = [
    { model: PRIMARY_MODEL, provider: PRIMARY_PROVIDER, maxRetries: 2 },
    { model: FALLBACK_MODEL_1, provider: FALLBACK_PROVIDER_1, maxRetries: 2 },
    { model: FALLBACK_MODEL_2, provider: FALLBACK_PROVIDER_2, maxRetries: 1 },
    { model: FALLBACK_MODEL_3, provider: FALLBACK_PROVIDER_3, maxRetries: 1 },
  ];
  
  return _fallbackChain;
}

export { getFallbackChain as FALLBACK_CHAIN };

export function getDefaultModel() {
  return getFallbackChain()[0];
}

export function getNextFallback(currentModel: string): { model: string; provider: string } | null {
  const chain = getFallbackChain();
  const currentIndex = chain.findIndex(f => f.model === currentModel);
  if (currentIndex === -1 || currentIndex >= chain.length - 1) {
    return null;
  }
  return chain[currentIndex + 1];
}

export function shouldRetry(error: any, currentRetry: number, model: string): boolean {
  const chain = getFallbackChain();
  const fallback = chain.find(f => f.model === model);
  if (!fallback) return false;
  
  const retryableErrors = [
    'overloaded',
    'rate limit',
    'timeout',
    'network',
    '429',
    '503',
    '500',
  ];
  
  const errorMessage = error?.message?.toLowerCase() || '';
  const isRetryable = retryableErrors.some(err => errorMessage.includes(err));
  
  return isRetryable && currentRetry < fallback.maxRetries;
}
