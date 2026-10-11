import { useState, useEffect, useCallback } from 'react';
import { Message } from '../types';
import { chatAPI } from '../services/api';

export interface UseChatReturn {
  messages: Message[];
  sendMessage: (question: string) => Promise<void>;
  isLoading: boolean;
  conversationId: string | null;
  clearConversation: () => void;
  error: string | null;
}

export const useChat = (documentId?: string): UseChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load chat history if available
  useEffect(() => {
    if (!documentId) {
      setMessages([]);
      setConversationId(null);
      return;
    }

    const loadHistory = async () => {
      try {
        const res = await chatAPI.history(documentId);
        if (Array.isArray(res.data)) {
          setMessages(res.data);
        }
      } catch {
        // Backend chat history might be empty or 404
      }
    };

    loadHistory();
  }, [documentId]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!documentId || !question.trim()) return;

      const trimmedQuestion = question.trim();
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmedQuestion,
        citations: [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const res = await chatAPI.send(documentId, trimmedQuestion, conversationId || undefined);
        const data = res.data;

        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        const assistantMsg: Message = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to get answer from legal assistant';
        setError(errMsg);
        const errorMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error: ${errMsg}. Please verify that the backend AI service is configured and try again.`,
          citations: [],
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [documentId, conversationId]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    conversationId,
    clearConversation,
    error,
  };
};
