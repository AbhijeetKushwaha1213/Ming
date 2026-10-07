
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Lightbulb, BookOpen, Target, Zap, MessageCircle } from 'lucide-react';

export const AIAssistant = () => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const suggestions = [
    {
      icon: Target,
      title: "What should I study next?",
      description: "Get personalized study recommendations",
      color: "from-blue-500 to-indigo-600"
    },
    {
      icon: BookOpen,
      title: "Explain this concept",
      description: "Get detailed explanations with examples",
      color: "from-green-500 to-teal-600"
    },
    {
      icon: Lightbulb,
      title: "Study tips for Physics",
      description: "Subject-specific learning strategies",
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: Zap,
      title: "Quick revision session",
      description: "15-minute focused review",
      color: "from-orange-500 to-red-600"
    }
  ];

  const aiMessages = [
    {
      type: 'ai',
      content: "Hi Abhijeet! 👋 I see you've been making great progress in Physics. Based on your recent performance, I recommend focusing on Electromagnetic Induction next. Would you like me to create a study plan for this topic?",
      time: "2 min ago"
    },
    {
      type: 'user',
      content: "Yes, please create a study plan for electromagnetic induction",
      time: "1 min ago"
    },
    {
      type: 'ai',
      content: "Perfect! Here's your personalized study plan for Electromagnetic Induction:\n\n📚 Day 1-2: Faraday's Law fundamentals\n🎥 Recommended: Khan Academy's EM Induction series\n📝 Practice: 10 conceptual problems\n🧪 Day 3: Lenz's Law and applications\n\nShall I add this to your study timeline?",
      time: "Just now"
    }
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
      }, 2000);
      setMessage('');
    }
  };

  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Your AI
            <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent"> Study Mentor</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get instant help, personalized recommendations, and motivational support from your intelligent study companion.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* AI Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-96 flex flex-col bg-card/70 backdrop-blur-md border border-border shadow-xl">
              {/* Chat Header */}
              <div className="flex items-center p-4 border-b border-border bg-card/80 backdrop-blur-sm rounded-t-lg">
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center mr-3">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">AI Study Mentor</h3>
                  <p className="text-sm text-muted-foreground">Always here to help</p>
                </div>
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Online</Badge>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {aiMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      msg.type === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary text-secondary-foreground shadow-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      <p className={`text-xs mt-2 ${msg.type === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-secondary px-4 py-3 rounded-2xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
                <div className="flex space-x-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask me anything about your studies..."
                    className="flex-1 bg-background"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    variant="premium"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Suggestions */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground mb-4">Quick Actions</h3>
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1">
                <div className={`w-10 h-10 bg-gradient-to-br ${suggestion.color} rounded-lg flex items-center justify-center mb-3`}>
                  <suggestion.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">{suggestion.title}</h4>
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              </Card>
            ))}

            {/* AI Insights Card */}
            <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-bold text-foreground mb-2">AI Insights</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  "You learn best in the morning hours. Consider scheduling difficult topics between 9-11 AM."
                </p>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Personalized Tip
                </Badge>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
