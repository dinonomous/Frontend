import api from '../utils/axios';

export interface GenerateCompletionRequest {
  model: string;
  prompt?: string;
  suffix?: string;
  images?: string[];
  think?: boolean;
  format?: 'json' | Record<string, any>;
  options?: Record<string, any>;
  system?: string;
  template?: string;
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string | number;
  context?: number[];
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

export interface StreamingCompletionResponse {
  model: string;
  created_at: number;
  response: string;
  done: boolean;
  error?: string;
}

export const generateCompletionStream = async (
    payload: GenerateCompletionRequest,
    onChunk: (chunk: StreamingCompletionResponse) => void,
    onError?: (error: Error) => void
): Promise<void> => {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...payload, stream: true }),
        });

        if (!response.body) {
            throw new Error('No response body available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data: StreamingCompletionResponse = JSON.parse(line.slice(6));
                        onChunk(data);
                        if (data.done) return;
                    } catch (e) {
                        console.warn('Failed to parse SSE data:', line);
                    }
                }
            }
        }
    } catch (error) {
        if (onError) {
            onError(error as Error);
        } else {
            throw error;
        }
    }
};

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
  const response = await api.post('/model/generate', { model });
  return response.data;
};

export const unloadModel = async (model: string): Promise<GenerateCompletionResponse> => {
  const response = await api.post('/model/generate', {
    model,
    keep_alive: 0
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
  const response = await api.post('/model/show', { model, verbose });
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
