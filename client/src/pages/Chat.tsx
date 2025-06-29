import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Send, Bot, Settings, Trash2 } from 'lucide-react';
import { useModel, useTheme } from '@/context/ModelContext';
import type { Message } from '../../types';
import { SettingsPanel } from '@/components/Settings';
import { MessageComponent } from '@/components/Message';
import { StreamEvent } from '@/api/ollama';
import { streamApiRequest } from '@/api/ollama';
import { ChatInput } from '@/components/ChatInput';
import { IconButton } from '@/components/IconButton';
import { DotLoader } from '@/components/DotLoader';
import ChatSidePanel from '@/components/SidePannel';

// Main Chat Component
export default function ChatBot() {
    const { model } = useModel();
    console.log(model)
    const { theme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            // Replace '/api/chat/stream' with your actual streaming endpoint
            await streamApiRequest(
                url,
                {
                    message: content,
                    model: model,
                    stream: true
                },
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
                        // Stream completed
                        console.log('Stream completed');
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

    const handleClearChat = () => {
        // Cancel any ongoing request
        if (abortController) {
            abortController.abort();
        }

        setMessages([{
            id: '1',
            content: "Hello! I'm your AI assistant. How can I help you today?",
            role: 'assistant',
            timestamp: new Date(),
            model
        }]);
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
        <div className={`${theme === 'dark' ? 'dark' : ''}`}>
            <ChatSidePanel />
            <div className="flex flex-col h-screen bg-background text-foreground transition-colors duration-300 ease-in-out">

                {/* Header */}
                <header className="sticky top-0 z-10 px-6 py-4  backdrop-blur shadow-sm">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">AI Chat Assistant</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {isLoading && (
                                <button
                                    onClick={handleCancelRequest}
                                    className="text-sm px-3 py-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                                >
                                    Cancel
                                </button>
                            )}
                            <IconButton icon={<Trash2 size={18} />} onClick={handleClearChat} label="Clear chat" />
                            <IconButton icon={<Settings size={18} />} onClick={() => setShowSettings(!showSettings)} label="Settings" />
                            <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
                        </div>
                    </div>
                </header>

                {/* Chat messages */}
                <main className="flex-1 overflow-y-auto px-6">
                    <div className="max-w-3xl mx-auto space-y-6 py-4">
                        {messages.map(message => (
                            <MessageComponent key={message.id} message={message} onCopy={handleCopyMessage} />
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
                        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                    </div>
                </footer>
            </div>
        </div>
    );
}