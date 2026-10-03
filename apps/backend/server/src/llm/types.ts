/**
 * LLM Client Types
 * 
 * Type definitions for LLM interaction.
 * Follows OpenAI API format but adapts to the real API.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface LLMCompletionRequest {
  model: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  timeout?: number;
}

export interface LLMCompletionResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: LLMToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'error' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string = 'LLM request timeout') {
    super('LLM_TIMEOUT', message, 504);
  }
}

export class LLMAuthError extends LLMError {
  constructor(message: string = 'LLM authentication failed') {
    super('LLM_AUTH_ERROR', message, 401);
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string = 'LLM rate limit exceeded') {
    super('LLM_RATE_LIMIT', message, 429);
  }
}

export class LLMInvalidResponseError extends LLMError {
  constructor(message: string = 'LLM invalid response') {
    super('LLM_INVALID_RESPONSE', message, 500);
  }
}
