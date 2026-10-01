
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { History, Search, MessageCircle, Trash2, Clock } from 'lucide-react';
import { useChatHistory, ChatSession } from '@/hooks/useChatHistory';
import { format } from 'date-fns';

interface ChatHistoryPanelProps {
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
}

export const ChatHistoryPanel = ({ onSelectSession, onNewChat }: ChatHistoryPanelProps) => {
  const { chatSessions, isLoading, deleteChatSession } = useChatHistory();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = chatSessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Chat History</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onNewChat}>
          New Chat
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <Input
          placeholder="Search chats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-96">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No chat sessions yet</p>
            <p className="text-gray-400 text-xs">Start a conversation to see your history</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((session) => (
              <Card
                key={session.id}
                className="p-3 hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                onClick={() => onSelectSession(session)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate text-sm">
                      {session.title}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {session.topic}
                      </Badge>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(new Date(session.updated_at), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {session.messages.length} messages
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(session.id);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
