"use client";
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MessagesProps {
  otherUserId: number;
  otherUserName: string;
  onClose: () => void;
}

const Messages: React.FC<MessagesProps> = ({ otherUserId, otherUserName, onClose }) => {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    // TODO: Implement actual message sending
    console.log('Sending message:', newMessage);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-screen max-h-[600px] bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#02fa97] to-teal-400">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#02fa97] font-bold">
            {otherUserName.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{otherUserName}</h3>
            <p className="text-xs text-white/80">Online</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-white/80 text-xl"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-center text-gray-500 mt-8">
          <div className="text-4xl mb-2">💬</div>
          <p>Start a conversation with {otherUserName}</p>
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${otherUserName}...`}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-[#02fa97] text-white px-6 py-2 rounded-full hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default Messages;