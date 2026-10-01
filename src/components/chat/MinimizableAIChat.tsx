import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minimize2, Maximize2, X, MessageSquare } from 'lucide-react';
import { AIChat } from './AIChat';

interface MinimizableAIChatProps {
  onClose?: () => void;
  defaultMinimized?: boolean;
  className?: string;
}

export const MinimizableAIChat = ({ 
  onClose, 
  defaultMinimized = false,
  className = ''
}: MinimizableAIChatProps) => {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [isDocked, setIsDocked] = useState(false);

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleDocked = () => {
    setIsDocked(!isDocked);
  };

  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          onClick={toggleMinimized}
          className="h-12 w-12 rounded-full bg-brand-gradient text-white shadow-glow"
          size="icon"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`${isDocked ? 'fixed bottom-0 right-4 w-96 h-96' : 'w-full h-full'} z-40 ${className}`}>
      <Card className="h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Dock/Undock Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDocked}
              className="h-8 w-8"
              title={isDocked ? "Expand" : "Dock to corner"}
            >
              {isDocked ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            
            {/* Minimize Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMinimized}
              className="h-8 w-8"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            
            {/* Close Button */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* AI Chat Content */}
        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </Card>
    </div>
  );
};