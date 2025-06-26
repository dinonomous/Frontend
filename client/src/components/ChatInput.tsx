"use client";
import { useState } from 'react';
import { useModel } from '@/context/ModelContext';

type ChatInputProps = {
  onSend: (message: string, model: string) => void;
  disabled?: boolean;
};

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const { model } = useModel();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        onSend(message, model);
        setMessage('');
      }
    }
  };

  return (
    <div className="flex flex-col border-t border-gray-300 p-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
        placeholder="Type your message..."
        className="w-full resize-none rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</span>
        <span className="text-xs text-gray-600">Model: {model}</span>
      </div>
    </div>
  );
};
