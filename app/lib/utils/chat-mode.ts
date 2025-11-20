/**
 * Utility to determine if streaming should be enabled
 * Returns false for production to avoid Vercel streaming issues
 */
export function isStreamingEnabled(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: check environment variable
    return process.env.VITE_ENABLE_STREAMING === 'true';
  }
  
  // Client-side: check import.meta.env
  return import.meta.env.VITE_ENABLE_STREAMING === 'true';
}

/**
 * Get the appropriate chat API endpoint based on streaming mode
 */
export function getChatEndpoint(): string {
  return isStreamingEnabled() ? '/api/chat' : '/api/chat-nonstream';
}
