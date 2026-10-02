
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface ChatSession {
  id: string;
  title: string;
  topic: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
}

const getLocalStorageKey = (userId?: string) => `studymate_chat_sessions_${userId || 'guest'}`;

function getLocalSessions(userId?: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local chat sessions:', e);
    return [];
  }
}

function setLocalSessions(userId: string | undefined, sessions: ChatSession[]) {
  try {
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(sessions));
  } catch (e) {
    console.warn('Failed to save local chat sessions:', e);
  }
}

export const useChatHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch chat sessions
  const {
    data: chatSessions = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['chat_sessions', user?.user_id],
    queryFn: async () => {
      const localSessions = getLocalSessions(user?.user_id);

      if (!user?.user_id) {
        return localSessions;
      }
      
      try {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.user_id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.warn('Error fetching Supabase chat sessions, using local storage:', error);
          return localSessions;
        }

        // Transform the data to match our ChatSession interface
        const remoteSessions: ChatSession[] = (data || []).map(session => {
          let parsedMessages = [];
          
          try {
            if (Array.isArray(session.messages)) {
              parsedMessages = session.messages.map((msg: any) => ({
                role: (msg.role === 'user' || msg.role === 'assistant') ? msg.role : 'user',
                content: String(msg.content || ''),
                timestamp: msg.timestamp || new Date().toISOString()
              }));
            }
          } catch (e) {
            console.error('Error parsing messages for session:', session.id, e);
          }

          return {
            id: session.id,
            title: session.title,
            topic: session.topic,
            messages: parsedMessages,
            created_at: session.created_at,
            updated_at: session.updated_at
          };
        });

        // Merge local & remote sessions by ID
        const mergedMap = new Map<string, ChatSession>();
        for (const s of remoteSessions) {
          mergedMap.set(s.id, s);
        }
        for (const s of localSessions) {
          if (!mergedMap.has(s.id) || new Date(s.updated_at) > new Date(mergedMap.get(s.id)!.updated_at)) {
            mergedMap.set(s.id, s);
          }
        }

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        setLocalSessions(user.user_id, merged);
        return merged;
      } catch (e) {
        console.warn('Failed to fetch chat sessions from server, using local:', e);
        return localSessions;
      }
    },
  });

  // Save chat session
  const saveChatSession = useMutation({
    mutationFn: async (sessionData: {
      id?: string;
      title: string;
      topic: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
    }) => {
      const now = new Date().toISOString();
      const existingList = getLocalSessions(user?.user_id);
      const sessionId = sessionData.id || `session_${Date.now()}`;

      const newSession: ChatSession = {
        id: sessionId,
        title: sessionData.title || 'Study Chat',
        topic: sessionData.topic || 'General',
        messages: sessionData.messages,
        created_at: now,
        updated_at: now,
      };

      const existingIdx = existingList.findIndex(s => s.id === sessionId);
      let updatedList: ChatSession[];
      if (existingIdx >= 0) {
        newSession.created_at = existingList[existingIdx].created_at;
        updatedList = [
          newSession,
          ...existingList.filter(s => s.id !== sessionId)
        ];
      } else {
        updatedList = [newSession, ...existingList];
      }
      setLocalSessions(user?.user_id, updatedList);

      // Save to Supabase if authenticated
      if (user?.user_id) {
        try {
          if (existingIdx >= 0) {
            await supabase
              .from('chat_sessions')
              .update({
                title: newSession.title,
                topic: newSession.topic,
                messages: newSession.messages,
                updated_at: now,
              })
              .eq('id', sessionId);
          } else {
            await supabase
              .from('chat_sessions')
              .insert([{
                id: sessionId,
                title: newSession.title,
                topic: newSession.topic,
                messages: newSession.messages,
                user_id: user.user_id,
              }]);
          }
        } catch (err) {
          console.warn('Could not sync chat session to Supabase, persisted locally:', err);
        }
      }

      return newSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_sessions'] });
    },
    onError: (error) => {
      console.error('Error saving chat session:', error);
    },
  });

  // Update chat session
  const updateChatSession = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ChatSession> }) => {
      const existingList = getLocalSessions(user?.user_id);
      const now = new Date().toISOString();
      const updatedList = existingList.map(s => {
        if (s.id === id) {
          return {
            ...s,
            ...updates,
            updated_at: now,
          };
        }
        return s;
      });
      setLocalSessions(user?.user_id, updatedList);

      if (user?.user_id) {
        try {
          await supabase
            .from('chat_sessions')
            .update({
              title: updates.title,
              topic: updates.topic,
              messages: updates.messages,
              updated_at: now,
            })
            .eq('id', id);
        } catch (e) {
          console.warn('Supabase update failed:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_sessions'] });
    },
  });

  // Delete chat session
  const deleteChatSession = useMutation({
    mutationFn: async (id: string) => {
      const existingList = getLocalSessions(user?.user_id);
      const filtered = existingList.filter(s => s.id !== id);
      setLocalSessions(user?.user_id, filtered);

      if (user?.user_id) {
        try {
          await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', id);
        } catch (e) {
          console.warn('Supabase delete failed:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_sessions'] });
      toast({
        title: "Chat Deleted",
        description: "Chat session has been removed.",
      });
    },
  });

  return {
    chatSessions,
    isLoading,
    error,
    saveChatSession: saveChatSession.mutate,
    updateChatSession: updateChatSession.mutate,
    deleteChatSession: deleteChatSession.mutate,
    isSaving: saveChatSession.isPending,
    isUpdating: updateChatSession.isPending,
    isDeleting: deleteChatSession.isPending,
  };
};
