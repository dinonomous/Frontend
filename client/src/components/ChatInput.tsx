"use client";
import { useState, useRef, useEffect } from 'react';
import { useModel } from '@/context/ModelContext';
import { Sparkles, Send } from 'lucide-react';

type ChatInputProps = {
  onSend: (message: string, model: string) => void;
  disabled?: boolean;
};

export const ChatInput = ({ onSend, disabled }: { onSend: (message: string) => void; disabled?: boolean }) => {
    const { model } = useModel();
    const [message, setMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (message.trim() && !disabled) {
            onSend(message.trim());
            setMessage('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [message]);

    const canSend = message.trim() && !disabled;

    return (
        <div className="relative">
            {/* Gradient background overlay */}
            
            <div className="relative backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Input container */}
                    <div className={`
                        relative transition-all duration-300 ease-out
                        
                    `}>
                        <div className={`
                            relative rounded-2xl border transition-all duration-300
                            ${isFocused 
                                ? 'border-blue-500/50 dark:border-blue-400/50 bg-white dark:bg-gray-800' 
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
                            }
                            backdrop-blur-xl
                        `}>
                            
                            <div className="relative">
                                <textarea
                                    ref={textareaRef}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    disabled={disabled}
                                    placeholder="Ask anything..."
                                    className={`
                                        w-full resize-none bg-transparent px-6 py-4 pr-16
                                        text-gray-900 dark:text-gray-100 
                                        placeholder-gray-400 dark:placeholder-gray-500
                                        focus:outline-none
                                        min-h-[56px] max-h-[120px]
                                        text-[15px] leading-relaxed
                                        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                                    `}
                                    rows={1}
                                />
                                
                                {/* Send button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={!canSend}
                                    className={`
                                        absolute bottom-3 right-3 p-2.5 rounded-xl
                                        transition-all duration-200 ease-out
                                        ${canSend
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    <Send size={18} className={canSend ? 'animate-pulse' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom info bar */}
                    <div className="flex justify-between items-center mt-4 px-2">
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">
                                    ↵
                                </kbd>
                                Send
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">
                                    ⇧↵
                                </kbd>
                                New line
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                <Sparkles size={12} className="text-blue-500" />
                                <span className="font-medium">{model}</span>
                            </div>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Online" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};