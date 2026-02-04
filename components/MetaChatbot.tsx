"use client";
import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'meta';
  timestamp: Date;
}

const MetaChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi there! I\'m Meta, your college assistant. How can I help you today?',
      sender: 'meta',
      timestamp: new Date(),
    },
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);
  
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // In a real app, this would call your API
    // const response = await fetch('/api/meta/chat', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ message: input }),
    // });
    // const data = await response.json();
    
    // Simulate API response
    setTimeout(() => {
      const metaMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'This is a simulated response. In a real app, this would be the AI response from your API.',
        sender: 'meta',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, metaMessage]);
    }, 1000);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#FFAF50] text-[#1E1E1E] flex items-center justify-center shadow-lg hover:bg-opacity-90 transition-colors"
      >
        <span className="text-2xl">🤖</span>
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[70vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-[#FFAF50] px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-xl mr-2">🤖</span>
          <h3 className="font-bold text-[#1E1E1E]">Meta Chatbot</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[#1E1E1E] hover:bg-orange-500 rounded-full p-1"
        >
          ✕
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-[#1E1E1E] text-white rounded-tr-none'
                  : 'bg-[#FFAF50] text-[#1E1E1E] rounded-tl-none'
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <p className="text-xs opacity-70 mt-1 text-right">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-gray-500 max-h-32"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            className={`ml-2 p-2 rounded-full ${
              input.trim() ? 'text-[#FFAF50] hover:bg-gray-200' : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            📤
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by AI • For college-related questions only
        </p>
      </div>
    </div>
  );
};

export default MetaChatbot;
