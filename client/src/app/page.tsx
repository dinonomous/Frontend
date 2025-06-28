"use client";
import Image from "next/image";
import { useState } from "react";
import { ModelProvider } from '@/context/ModelContext';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatInput } from '@/components/ChatInput';
import BotResponse from '../components/BotResponce';
import type { GenerateCompletionRequest } from '@/api/ollama';

export default function Home() {
  const [currentRequest, setCurrentRequest] = useState<GenerateCompletionRequest | null>(null);
  const [showResponse, setShowResponse] = useState(false);

  const handleSend = (msg: string, model: string) => {
    console.log('Send:', msg, 'to model:', model);
    
    // Create the request object for the bot response
    const request: GenerateCompletionRequest = {
      model: model,
      prompt: msg,
      stream: true, // Enable streaming
    };

    // Set the request and show the bot response component
    setCurrentRequest(request);
    setShowResponse(true);
  };

  const handleResponseComplete = (fullResponse: string) => {
    console.log('Response completed:', fullResponse);
    // You can handle the complete response here if needed
  };

  const handleResponseError = (error: string) => {
    console.error('Response error:', error);
    // Handle errors here
  };

  return (
    <ModelProvider>
      <div className="max-w-2xl mx-auto p-4">
        <ModelSelector />
        <div className="mt-4 border rounded shadow">
          {/* Chat messages area */}
          <div className="p-4 min-h-[200px]">
            {showResponse && currentRequest && (
              <div className="mb-4">
                {/* Display the user message */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  <div className="text-sm text-blue-600 font-medium">You</div>
                  <div className="text-gray-800 mt-1">{currentRequest.prompt}</div>
                </div>
                
                {/* Display the bot response */}
                <BotResponse
                  request={currentRequest}
                  onComplete={handleResponseComplete}
                  onError={handleResponseError}
                  className="w-full"
                  chat={false}
                />
              </div>
            )}
            
            {!showResponse && (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <p>Start a conversation by typing a message below</p>
              </div>
            )}
          </div>
          
          <ChatInput onSend={handleSend} />
        </div>
      </div>
    </ModelProvider>
  );
}