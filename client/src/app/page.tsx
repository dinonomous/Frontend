"use client";
import Image from "next/image";
import { ModelProvider } from '@/context/ModelContext';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatInput } from '@/components/ChatInput';

export default function Home() {
  const handleSend = (msg: string, model: string) => {
    console.log('Send:', msg, 'to model:', model);
    // Call Ollama stream API here
  };

  return (
    <ModelProvider>
      <div className="max-w-2xl mx-auto p-4">
        <ModelSelector />
        <div className="mt-4 border rounded shadow">
          {/* Chat messages can go here */}
          <ChatInput onSend={handleSend} />
        </div>
      </div>
    </ModelProvider>
  );
}
