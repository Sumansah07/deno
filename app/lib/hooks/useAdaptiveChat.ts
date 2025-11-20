import { useChat } from '@ai-sdk/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message } from 'ai';
import { generateId } from 'ai';

const isStreamingEnabled = () => {
  return import.meta.env.VITE_ENABLE_STREAMING === 'true';
};

export function useAdaptiveChat(options: Parameters<typeof useChat>[0]) {
  const streamingEnabled = isStreamingEnabled();
  
  // Use streaming hook if enabled
  const streamingChat = useChat(streamingEnabled ? options : { ...options, api: '/api/chat-disabled' });
  
  // Non-streaming state
  const [nonStreamMessages, setNonStreamMessages] = useState<Message[]>(options.initialMessages || []);
  const [nonStreamInput, setNonStreamInput] = useState(options.initialInput || '');
  const [nonStreamLoading, setNonStreamLoading] = useState(false);
  const [nonStreamError, setNonStreamError] = useState<Error | undefined>();
  const [nonStreamData, setNonStreamData] = useState<any>();
  
  // Use ref to always have latest messages without causing re-renders
  const messagesRef = useRef<Message[]>(options.initialMessages || []);
  
  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = nonStreamMessages;
  }, [nonStreamMessages]);

  const nonStreamAppend = useCallback(async (message: Message, attachmentOptions?: any) => {
    setNonStreamLoading(true);
    setNonStreamError(undefined);
    
    // Use ref to get latest messages, avoiding stale closure
    const newMessages = [...messagesRef.current, message];
    setNonStreamMessages(newMessages);

    try {
      const useKimiPlanning = localStorage.getItem('kimiPlanning') !== 'false';
      
      const response = await fetch('/api/chat-nonstream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          useKimiPlanning,
          ...options.body,
        }),
      });

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          // Handle non-JSON responses (like plain text "Unauthorized")
          const text = await response.text();
          errorData = {
            error: true,
            message: text || `Request failed with status ${response.status}`,
            statusCode: response.status,
          };
        }
        
        const error = new Error(JSON.stringify(errorData));
        throw error;
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: result.id,
        role: 'assistant',
        content: result.content,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setNonStreamMessages(finalMessages);
      
      // Call onFinish callback
      if (options.onFinish) {
        options.onFinish(assistantMessage, {
          usage: result.usage,
          finishReason: 'stop',
        } as any);
      }

      setNonStreamLoading(false);
    } catch (error: any) {
      setNonStreamError(error);
      setNonStreamLoading(false);
      
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [options]);

  const nonStreamReload = useCallback(async (attachmentOptions?: any) => {
    const currentMessages = messagesRef.current;
    if (currentMessages.length === 0) return;
    
    // Remove last assistant message and resend last user message
    const messagesWithoutLast = currentMessages.slice(0, -1);
    const lastUserMessage = messagesWithoutLast[messagesWithoutLast.length - 1];
    
    if (lastUserMessage && lastUserMessage.role === 'user') {
      setNonStreamMessages(messagesWithoutLast.slice(0, -1));
      await nonStreamAppend(lastUserMessage, attachmentOptions);
    }
  }, [nonStreamAppend]);

  const nonStreamStop = useCallback(() => {
    setNonStreamLoading(false);
  }, []);

  const nonStreamSetMessages = useCallback((messages: Message[]) => {
    setNonStreamMessages(messages);
  }, []);

  const nonStreamHandleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNonStreamInput(e.target.value);
  }, []);

  const nonStreamSetInput = useCallback((value: string) => {
    setNonStreamInput(value);
  }, []);

  const nonStreamSetData = useCallback((data: any) => {
    setNonStreamData(data);
  }, []);

  const nonStreamAddToolResult = useCallback(({ toolCallId, result }: { toolCallId: string; result: any }) => {
    // Handle tool results for non-streaming
    console.log('Tool result:', toolCallId, result);
  }, []);

  // Return appropriate interface based on mode
  if (streamingEnabled) {
    return streamingChat;
  }

  return {
    messages: nonStreamMessages,
    isLoading: nonStreamLoading,
    input: nonStreamInput,
    handleInputChange: nonStreamHandleInputChange,
    setInput: nonStreamSetInput,
    stop: nonStreamStop,
    append: nonStreamAppend,
    setMessages: nonStreamSetMessages,
    reload: nonStreamReload,
    error: nonStreamError,
    data: nonStreamData,
    setData: nonStreamSetData,
    addToolResult: nonStreamAddToolResult,
  };
}
