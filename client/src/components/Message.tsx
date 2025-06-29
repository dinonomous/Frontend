"use client";
import { useState } from "react";
import { Bot, User, Copy, Check } from 'lucide-react';
import type { Message } from "../../types";
import { useModel } from "@/context/ModelContext";

export const MessageComponent = ({ message, onCopy }: { message: Message; onCopy: (content: string) => void }) => {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const { model } = useModel();

    const handleCopy = () => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isUser = message.role === 'user';

    return (
        <div
            className={`group relative transition-all duration-200 ease-out ${isUser
                    ? 'ml-8 mb-6'
                    : 'mr-8 mb-8'
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Message container with subtle background and shadow */}
            <div className={`relative rounded-2xl px-5 py-4 transition-all duration-300 ease-out ${isUser
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-100/50 dark:border-blue-800/30'
                    : ''
                } ${isHovered ? 'scale-[1.01] shadow-lg' : ''}`}>

                {/* Avatar */}
                <div className={`absolute -top-3 ${isUser ? '-right-3' : '-left-3'} w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${isUser
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg'
                        : ''
                    } ${isHovered ? 'scale-110 shadow-xl' : ''}`}>
                    {isUser ? <User size={14} /> : ""}
                </div>

                {/* Message header */}
                <div className={`flex items-center gap-3 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </span>
                    <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isUser && (
                            <div className={`mt-4 flex justify-start transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                                }`}>
                                <button
                                    onClick={handleCopy}
                                    className={`group/btn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${copied
                                            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-800/50'
                                            : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300/50 dark:hover:border-gray-600/50'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-600`}
                                    aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
                                >
                                    <div className={`transition-all duration-200 ${copied ? 'scale-110' : 'group-hover/btn:scale-105'}`}>
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                    </div>
                                    <span className="tracking-wide">
                                        {copied ? 'Copied!' : 'Copy'}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Message content */}
                <div className={`prose prose-sm max-w-none leading-relaxed ${isUser
                        ? 'text-gray-800 dark:text-gray-200 text-right'
                        : 'text-gray-700 dark:text-gray-300'
                    } dark:prose-invert prose-p:my-2 prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100`}>
                    <div className={`${isUser ? 'text-right' : 'text-left'}`}>
                        {message.content}
                    </div>
                </div>

                <div className={`flex items-center gap-2 mt-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {message.model && (
                        <div className="px-2.5 py-1 rounded-full bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tracking-wide">
                                {model}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtle connector line for conversation flow */}
            {!isUser && (
                <div className="absolute -bottom-4 left-3 w-px h-4 bg-gradient-to-b from-gray-200 to-transparent dark:from-gray-700 opacity-30"></div>
            )}
        </div>
    );
};