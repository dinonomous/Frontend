import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Send, Bot, Settings, Trash2 } from 'lucide-react';
import { useModel, useTheme, usePersona } from '@/context/ModelContext';
import type { Message } from '../../types';
import SettingsPanel from '@/components/Settings';
import { MessageComponent } from '@/components/Message';
import { StreamEvent } from '@/api/ollama';
import { streamApiRequest } from '@/api/ollama';
import { ChatInput } from '@/components/ChatInput';
import { IconButton } from '@/components/IconButton';
import { DotLoader } from '@/components/DotLoader';
import ChatSidePanel from '@/components/SidePannel';

// Updated interface to match your new schema
interface GenerateCompletionRequest {
  model: string;
  persona?: number;
  query: string;
  stream?: boolean;
  language?: string; // defaults to "en"
  chat?: boolean;
  image?: string | string[];
  file?: string | string[];
  think?: boolean;
  keepalive?: string | number;
}

// Main Chat Component
export default function ChatBot() {
    const { model } = useModel();
    const { selectedPersona, selectedPersonaData } = usePersona();
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (content: string) => {
        // Cancel any ongoing request
        if (abortController) {
            abortController.abort();
        }

        const newAbortController = new AbortController();
        setAbortController(newAbortController);

        const userMessage: Message = {
            id: Date.now().toString(),
            content,
            role: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        // Create assistant message that will be updated as tokens stream in
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
            id: assistantMessageId,
            content: '',
            role: 'assistant',
            timestamp: new Date(),
            model
        };

        setMessages(prev => [...prev, assistantMessage]);

        try {
            const url = (`${process.env.NEXT_PUBLIC_API_URL || '/api'}/generate/stream`);
            
            // Updated request body to match new interface
            const requestBody: GenerateCompletionRequest = {
                model: model,
                query: content,
                stream: true,
                language: "en",
                chat: true,
                think: false,
                // Add other optional fields as needed:
                persona: selectedPersonaData?.id,
                // image: undefined,
                // file: undefined,
                // keepalive: undefined,
            };

            await streamApiRequest(
                url,
                requestBody,
                (event: StreamEvent) => {
                    // Handle different event types
                    if (event.event === 'token' || event.event === 'content') {
                        // Update the assistant message with new token
                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? { ...msg, content: msg.content + (event.data.token || event.data.content || '') }
                                : msg
                        ));
                    } else if (event.event === 'error') {
                        throw new Error(event.data.message || 'Streaming error occurred');
                    } else if (event.event === 'done') {
                        setIsLoading(false);
                    }
                },
                newAbortController.signal
            );
        } catch (error) {
            console.error('Streaming error:', error);

            // Remove the empty assistant message and add error message
            setMessages(prev => {
                const filtered = prev.filter(msg => msg.id !== assistantMessageId);
                const errorMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    content: error instanceof Error && error.name === 'AbortError'
                        ? "Request was cancelled."
                        : "I apologize, but I encountered an error processing your request. Please try again.",
                    role: 'assistant',
                    timestamp: new Date(),
                    model
                };
                return [...filtered, errorMessage];
            });
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };

    const handleCopyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleCancelRequest = () => {
        if (abortController) {
            abortController.abort();
        }
    };

    return (
        <div className={`${theme === 'dark' ? 'dark' : ''} h-screen relative overflow-y-hidden`}>
            <ChatSidePanel isExpanded={isExpanded} expand={() => setIsExpanded(!isExpanded)} />
            <div className={`"${isExpanded? "blur-sm" : ""} pl-16 flex flex-col h-screen bg-background text-foreground transition-colors duration-300 ease-in-out"`}>

                {/* Header */}
                <header className="h-12 px-4 flex justify-center">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{selectedPersona}</h1>
                        </div>
                    </div>
                </header>

                {/* Chat messages */}
                <main className="flex-1 custom-scroll w-full overflow-x-hidden px-6 mx-auto h-full">
                    <div className="max-w-3xl mx-auto space-y-6 py-4">
                        {messages.map(message => (
                            <MessageComponent key={message.id} message={message} onCopyAction={handleCopyMessage} />
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3 p-3 animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                    <Bot size={16} className="text-muted-foreground" />
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-sm font-medium">Assistant</span>
                                    <div className="flex gap-1">
                                        <DotLoader delay={0} />
                                        <DotLoader delay={100} />
                                        <DotLoader delay={200} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Input */}
                <footer className="px-6 py-2">
                    <div className="max-w-3xl mx-auto">
                        <ChatInput onSend={handleSendMessage} disabled={isLoading} handleCancelRequest={handleCancelRequest} />
                    </div>
                </footer>
            </div>
        </div>
    );
}