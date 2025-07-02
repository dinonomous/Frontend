"use client";
import { useState } from "react";
import { Bot, User, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Message } from "../../types";

export const MessageComponent = ({
    message,
    onCopy,
    darkMode = false
}: {
    message: Message;
    onCopy: (content: string) => void;
    darkMode?: boolean;
}) => {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleCopy = () => {
        // onCopyAction(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isUser = message.role === 'user';

    // Custom markdown components for better styling
    const markdownComponents = {
        // Headers with custom styling
        h1: ({ children }: any) => (
            <h1 className="text-3xl font-bold mb-6 mt-8 text-gray-900 dark:text-gray-100 border-b-2 border-blue-200 dark:border-blue-800 pb-2">
                {children}
            </h1>
        ),
        h2: ({ children }: any) => (
            <h2 className="text-2xl font-semibold mb-4 mt-6 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-1">
                {children}
            </h2>
        ),
        h3: ({ children }: any) => (
            <h3 className="text-xl font-semibold mb-3 mt-5 text-gray-800 dark:text-gray-200">
                {children}
            </h3>
        ),
        h4: ({ children }: any) => (
            <h4 className="text-lg font-medium mb-2 mt-4 text-gray-700 dark:text-gray-300">
                {children}
            </h4>
        ),
        h5: ({ children }: any) => (
            <h5 className="text-base font-medium mb-2 mt-3 text-gray-700 dark:text-gray-300">
                {children}
            </h5>
        ),
        h6: ({ children }: any) => (
            <h6 className="text-sm font-medium mb-2 mt-3 text-gray-600 dark:text-gray-400">
                {children}
            </h6>
        ),

        // Paragraphs with proper spacing
        p: ({ children }: any) => (
            <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300 last:mb-0">
                {children}
            </p>
        ),

        // Code blocks with syntax highlighting
        code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (!inline && language) {
                return (
                    <div className="relative my-4 group">
                        {/* Language label */}
                        <div className="flex items-center justify-between bg-neutral-700 dark:bg-gray-800 px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
                            <span className="uppercase tracking-wide">{language}</span>
                            <button
                                onClick={() => onCopy(String(children).replace(/\n$/, ''))}
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                                title="Copy code"
                            >
                                <Copy size={12} />
                                Copy
                            </button>
                        </div>
                        <SyntaxHighlighter
                            style={darkMode ? oneDark : oneLight}
                            language={language}
                            PreTag="div"
                            className="!mt-0 !rounded-t-none !rounded-b-lg text-sm"
                            showLineNumbers={language !== 'bash' && language !== 'shell'}
                            wrapLongLines
                            {...props}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    </div>
                );
            }

            return (
                <code
                    className="bg-neutral-800 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400 border border-gray-200 dark:border-gray-700"
                    {...props}
                >
                    {children}
                </code>
            );
        },

        // Blockquotes with beautiful styling
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300 rounded-r-lg">
                {children}
            </blockquote>
        ),

        // Lists with better spacing
        ul: ({ children }: any) => (
            <ul className="mb-4 space-y-1 text-gray-700 dark:text-gray-300 pl-6">
                {children}
            </ul>
        ),
        ol: ({ children }: any) => (
            <ol className="mb-4 space-y-1 text-gray-700 dark:text-gray-300 pl-6 list-decimal">
                {children}
            </ol>
        ),
        li: ({ children }: any) => (
            <li className="leading-relaxed marker:text-blue-500 dark:marker:text-blue-400">
                {children}
            </li>
        ),

        // Task lists
        input: ({ checked, ...props }: any) => (
            <input
                type="checkbox"
                checked={checked}
                disabled
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                {...props}
            />
        ),

        // Tables with beautiful styling
        table: ({ children }: any) => (
            <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {children}
                </table>
            </div>
        ),
        thead: ({ children }: any) => (
            <thead className="bg-gray-50 dark:bg-gray-800">
                {children}
            </thead>
        ),
        tbody: ({ children }: any) => (
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {children}
            </tbody>
        ),
        th: ({ children }: any) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {children}
            </th>
        ),
        td: ({ children }: any) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {children}
            </td>
        ),

        // Links with hover effects
        a: ({ href, children }: any) => (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-300 hover:decoration-blue-600 transition-colors duration-200 font-medium"
            >
                {children}
            </a>
        ),

        // Horizontal rules
        hr: () => (
            <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
        ),

        // Strong and emphasis
        strong: ({ children }: any) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
                {children}
            </strong>
        ),
        em: ({ children }: any) => (
            <em className="italic text-gray-800 dark:text-gray-200">
                {children}
            </em>
        ),

        // Strikethrough
        del: ({ children }: any) => (
            <del className="line-through text-gray-500 dark:text-gray-400">
                {children}
            </del>
        ),

        // Images with proper styling
        img: ({ src, alt }: any) => (
            <div className="my-4">
                <img
                    src={src}
                    alt={alt}
                    className="max-w-full h-auto rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
                />
                {alt && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 italic">
                        {alt}
                    </p>
                )}
            </div>
        ),
    };

    return (
        <div
            className={`w-full flex mb-6 ${isUser ? 'justify-end' : 'justify-left'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >

            <div className={`rounded-2xl px-4 py-4 transition-all duration-300 ease-out
    ${isUser
                    ? 'max-w-[90%] bg-gradient-to-br from-blue-50 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-100/50 dark:border-blue-800/30 shadow-sm'
                    : 'w-full overflow-auto '
                }`}>



                {/* Message header with timestamp and copy button */}
                <div className={`flex items-center ${isUser ? 'justify-end w-fit' : 'justify-between'}`}>

                    {!isUser && (
                        <div className={`transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
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

                {/* Enhanced message content with full Markdown support */}
                <div className={`markdown-content max-w-none ${isUser
                    ? 'text-right'
                    : ''
                    }`}>
                    {isUser ? (
                        // For user messages, show plain text with simple formatting
                        <div className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                            {message.content}
                        </div>
                    ) : (
                        // For AI messages, render full Markdown
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={markdownComponents}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}
                </div>
            </div>

            {/* Enhanced connector line for conversation flow */}
            {!isUser && (
                <div className="absolute -bottom-4 left-4 w-px h-4 bg-gradient-to-b from-emerald-200 to-transparent dark:from-emerald-700 opacity-40"></div>
            )}
        </div>
    );
};