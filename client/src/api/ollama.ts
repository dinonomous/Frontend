import api from '../utils/axios';

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

export interface GenerateCompletionResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export const generateCompletion = async (
  payload: GenerateCompletionRequest
): Promise<GenerateCompletionResponse> => {
  const response = await api.post('/generate', payload);
  return response.data;
};

export interface StreamEvent {
  event: string;
  data: any;
  id?: string;
  retry?: number;
}

export type OnStreamEvent = (event: StreamEvent) => void;

/**
 * Generic SSE POST streaming utility.
 * @param url - endpoint URL
 * @param payload - JSON payload
 * @param onEvent - handler called per parsed event
 * @param abortSignal - optional AbortSignal to cancel
 */
export async function streamApiRequest(
  url: string,
  payload: unknown,
  onEvent: OnStreamEvent,
  abortSignal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    // Process lines to build complete SSE events
    let currentEvent: Partial<StreamEvent> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and [DONE] markers
      if (!trimmed || trimmed === 'data: [DONE]') {
        // If we have a complete event, send it
        if (currentEvent.event && currentEvent.data !== undefined) {
          onEvent(currentEvent as StreamEvent);
          currentEvent = {};
        }
        continue;
      }
      
      // Parse event field
      if (trimmed.startsWith('event:')) {
        currentEvent.event = trimmed.slice(6).trim();
        continue;
      }
      
      // Parse data field
      if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        
        try {
          currentEvent.data = JSON.parse(dataStr);
          
        } catch (e) {
          // If JSON parsing fails, treat as string
          currentEvent.data = dataStr;
        }
        continue;
      }
      
      // Parse id field
      if (trimmed.startsWith('id:')) {
        currentEvent.id = trimmed.slice(3).trim();
        continue;
      }
      
      // Parse retry field
      if (trimmed.startsWith('retry:')) {
        currentEvent.retry = parseInt(trimmed.slice(6).trim(), 10);
        continue;
      }
    }
    
    // Send any remaining complete event
    if (currentEvent.event && currentEvent.data !== undefined) {
      onEvent(currentEvent as StreamEvent);
    }
  }
}

// -------- Chat Completion --------

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  images?: string[];
  tool_calls?: any[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  format?: 'json' | Record<string, any>;
  tools?: any[];
  options?: Record<string, any>;
  stream?: boolean;
  keep_alive?: string | number;
}

export interface ChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export const generateChat = async (
  payload: ChatRequest
): Promise<ChatResponse> => {
  const response = await api.post('/chat', payload);
  return response.data;
};

// -------- Model Management --------

export interface LocalModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export const listModels = async (): Promise<{ models: LocalModel[] }> => {
  const response = await api.get('/model/tags');
  return response.data;
};

export const loadModel = async (model: string): Promise<GenerateCompletionResponse> => {
  const response = await api.post('/model/load', { model });
  return response.data;
};

export const unloadModel = async (model: string): Promise<GenerateCompletionResponse> => {
  const response = await api.post('/model/unload', {
    model
  });
  return response.data;
};

// -------- Model Info --------

export interface ModelInfoResponse {
  modelfile: string;
  parameters: string;
  template: string;
  details: Record<string, any>;
  model_info?: Record<string, any>;
}

export const getModelInfo = async (
  model: string,
  verbose = false
): Promise<ModelInfoResponse> => {
  const response = await api.post('/model/info', { model, verbose });
  return response.data;
};

// -------- Embeddings --------

export interface EmbeddingRequest {
  model: string;
  prompt: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  created_at: string;
  model: string;
}

export const generateEmbedding = async (
  payload: EmbeddingRequest
): Promise<EmbeddingResponse> => {
  const response = await api.post('/embeddings', payload);
  return response.data;
};
