export type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  model?: string;
};

export type Model = {
  id: string;
  name: string;
  description: string;
};