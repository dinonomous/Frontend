import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, Copy, Check, Code, Zap, RotateCcw, Square } from 'lucide-react';
import { streamApiRequest } from '@/api/ollama';
import type { StreamEvent, OnStreamEvent } from '@/api/ollama';

interface GenerateCompletionRequest {
  model: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
  options?: Record<string, any>;
  stream?: boolean;
}

interface BotResponseProps {
  request: GenerateCompletionRequest;
  onComplete?: (fullResponse: string, codeBlocks?: CodeBlock[]) => void;
  onError?: (error: string) => void;
  className?: string;
  chat?: boolean;
}

interface CodeBlock {
  language?: string;
  content: string;
  start_position: number;
  end_position: number;
}

interface StreamingStats {
  tokenCount: number;
  tokensPerSecond: number;
  elapsedTime: number;
  totalDuration?: number;
  codeBlocksDetected?: number;
}

const BotResponse: React.FC<BotResponseProps> = ({
  request,
  onComplete,
  onError,
  className = '',
  chat = false
}) => {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<StreamingStats>({
    tokenCount: 0,
    tokensPerSecond: 0,
    elapsedTime: 0
  });
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [activeCodeBlock, setActiveCodeBlock] = useState<number | null>(null);
  
  const responseRef = useRef<HTMLDivElement>(null);
  const responseBufferRef = useRef('');
  const retryCountRef = useRef(0);
  const currentCodeContentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingActiveRef = useRef(false);
  const maxRetries = 3;

  const cleanup = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = null;
    streamingActiveRef.current = false;
    setActiveCodeBlock(null);
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {

    if (!streamingActiveRef.current) {
      return;
    }

    switch (event.event) {
      case 'start':
        setIsStreaming(true);
        setError(null);
        setIsComplete(false);
        responseBufferRef.current = '';
        setResponse('');
        setCodeBlocks([]);
        setActiveCodeBlock(null);
        retryCountRef.current = 0;
        streamingActiveRef.current = true;
        break;

      case 'token':
        if (event.data.token) {
          responseBufferRef.current += event.data.token;
          setResponse(responseBufferRef.current);
          
          // Update token count from event data
          if (event.data.count) {
            setStats(prev => ({
              ...prev,
              tokenCount: event.data.count
            }));
          }
        }
        break;

      case 'code_start':
        setActiveCodeBlock(event.data.code_block_id);
        currentCodeContentRef.current = '';
        break;

      case 'code_token':
        if (event.data.token) {
          currentCodeContentRef.current += event.data.token;
          responseBufferRef.current += event.data.token;
          setResponse(responseBufferRef.current);
        }
        break;

      case 'code_end':
        setActiveCodeBlock(null);
        if (event.data.content) {
          setCodeBlocks(prev => [...prev, {
            language: event.data.language,
            content: event.data.content,
            start_position: 0,
            end_position: 0
          }]);
        }
        break;

      case 'progress':
        setStats(prev => ({
          ...prev,
          tokenCount: event.data.count || prev.tokenCount,
          tokensPerSecond: event.data.tokens_per_second || 0,
          elapsedTime: event.data.elapsed || 0
        }));
        break;

      case 'metadata':
        setStats(prev => ({
          ...prev,
          totalDuration: event.data.duration,
          tokensPerSecond: event.data.tokens_per_second || prev.tokensPerSecond,
          codeBlocksDetected: event.data.code_blocks_detected || 0
        }));
        if (event.data.code_blocks) {
          setCodeBlocks(event.data.code_blocks);
        }
        break;

      case 'done':
        setIsStreaming(false);
        setIsComplete(true);
        streamingActiveRef.current = false;
        
        // Call onComplete with current code blocks
        const finalResponse = responseBufferRef.current.trim();
        const finalCodeBlocks = codeBlocks.length > 0 ? codeBlocks : [];
        onComplete?.(finalResponse, finalCodeBlocks);
        break;

      case 'error':
        console.error('Stream error:', event.data);
        const errorMsg = event.data.error || 'Unknown streaming error';
        setError(errorMsg);
        setIsStreaming(false);
        streamingActiveRef.current = false;
        onError?.(errorMsg);
        break;

      default:
    }
  }, [onComplete, onError, codeBlocks]);

  // Start streaming with enhanced error handling
  const startStreaming = useCallback(async () => {
    if (retryCountRef.current >= maxRetries) {
      setError(`Failed after ${maxRetries} attempts`);
      return;
    }

    try {
      setIsStreaming(true);
      setError(null);
      setIsComplete(false);
      streamingActiveRef.current = true;

      // Clean up any existing controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();

      const url = `${process.env.NEXT_PUBLIC_API_URL || '/api'}/generate/stream`;

      await streamApiRequest(
        url,
        { ...request, stream: true, is_chat: chat },
        handleStreamEvent,
        abortControllerRef.current.signal
      );

    } catch (err: any) {
      console.error('Streaming error caught:', err);
      
      if (err.name === 'AbortError') {
        return;
      }

      retryCountRef.current++;
      
      if (retryCountRef.current < maxRetries && streamingActiveRef.current) {
        const retryMsg = `Connection lost. Retrying... (${retryCountRef.current}/${maxRetries})`;
        setError(retryMsg);
        setTimeout(() => {
          if (streamingActiveRef.current) {
            startStreaming();
          }
        }, 1000 * retryCountRef.current);
      } else {
        const errorMsg = err.message || 'Unknown streaming error';
        setError(errorMsg);
        setIsStreaming(false);
        streamingActiveRef.current = false;
        onError?.(errorMsg);
      }
    }
  }, [request, chat, handleStreamEvent, onError]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    streamingActiveRef.current = false;
    setIsStreaming(false);
    cleanup();
    setIsComplete(true);
  }, [cleanup]);

  // Copy response to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [response]);

  // Retry streaming
  const retryStreaming = useCallback(() => {
    retryCountRef.current = 0;
    setIsComplete(false);
    setError(null);
    startStreaming();
  }, [startStreaming]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Start streaming on mount - but only once
  useEffect(() => {
    startStreaming();
    
    return () => {
      streamingActiveRef.current = false;
      cleanup();
    };
  }, []); // Empty dependency array - only run once on mount

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  // Render formatted response with syntax highlighting indicators
  const renderResponse = () => {
    if (!response) {
      return isStreaming ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generating response...</span>
        </div>
      ) : (
        <div className="text-gray-400 text-sm">Ready to start...</div>
      );
    }

    return (
      <div className="space-y-0">
        <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm font-mono">
          {response}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse"></span>
          )}
        </pre>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isStreaming ? 'bg-blue-500 animate-pulse' : 
              isComplete ? 'bg-green-500' : 
              error ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-medium text-gray-700">
              AI Response
            </span>
          </div>
          
          {/* Real-time stats */}
          {stats.tokenCount > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                <Zap className="w-3 h-3" />
                <span>{stats.tokenCount} tokens</span>
              </div>
              
              {stats.tokensPerSecond > 0 && (
                <div className="text-gray-500">
                  {stats.tokensPerSecond.toFixed(1)} t/s
                </div>
              )}
              
              {stats.codeBlocksDetected && stats.codeBlocksDetected > 0 && (
                <div className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                  <Code className="w-3 h-3" />
                  <span>{stats.codeBlocksDetected} code blocks</span>
                </div>
              )}
            </div>
          )}

          {/* Active code block indicator */}
          {activeCodeBlock && (
            <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full text-xs">
              <Code className="w-3 h-3 animate-pulse" />
              <span>Writing code...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {response && (
            <button
              onClick={copyToClipboard}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Copy response"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}

          {error && !isStreaming && (
            <button
              onClick={retryStreaming}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {isStreaming && (
            <button
              onClick={stopStreaming}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {retryCountRef.current > 0 ? 'Connection Issues' : 'Error'}
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                onClick={retryStreaming}
                className="mt-2 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={responseRef}
            className="min-h-[120px] max-h-[600px] overflow-y-auto rounded-lg bg-gray-50 p-4"
          >
            {renderResponse()}
          </div>
        )}
      </div>

      {/* Footer */}
      {isComplete && !error && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Complete</span>
              {codeBlocks.length > 0 && (
                <span className="text-xs text-green-600">
                  • {codeBlocks.length} code block{codeBlocks.length !== 1 ? 's' : ''} detected
                </span>
              )}
            </div>
            {stats.totalDuration && (
              <div className="text-xs text-green-600">
                {formatTime(stats.totalDuration / 1000)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {isStreaming && stats.elapsedTime > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
          <div className="flex items-center justify-between text-xs text-blue-600">
            <span>Streaming... {formatTime(stats.elapsedTime)}</span>
            {stats.tokensPerSecond > 0 && (
              <span>{stats.tokensPerSecond.toFixed(1)} tokens/sec</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BotResponse;