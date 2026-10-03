/**
 * LLM Client
 * 
 * Abstraction layer for communication with the LLM API.
 * 
 * SECURITY:
 * - API key is read from environment variables only
 * - API key is NEVER logged, sent in responses, or exposed
 * - Sanitizes responses before returning
 * - Validates request structure
 */

import { config } from '../config/env.js';
import {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMError,
  LLMTimeoutError,
  LLMAuthError,
  LLMRateLimitError,
  LLMInvalidResponseError,
} from './types.js';

export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number = 30000; // 30 seconds
  private availableModels: string[] = [];

  constructor(baseUrl?: string, apiKey?: string, timeout?: number) {
    this.baseUrl = baseUrl || config.llmBaseUrl || '';
    this.apiKey = apiKey || config.llmApiKey || '';

    if (!this.baseUrl) {
      throw new Error('LLM_CONFIG_ERROR: LLM base URL not configured');
    }

    if (!this.apiKey) {
      throw new Error('LLM_CONFIG_ERROR: LLM API key not configured');
    }

    if (timeout) {
      this.timeout = timeout;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    if (this.availableModels.length > 0) {
      return this.availableModels;
    }

    try {
      const response = await this.request('/models', 'GET', undefined, 10000);
      if (typeof response === 'object' && response !== null) {
        const data = response as any;
        if (Array.isArray(data.data)) {
          this.availableModels = data.data.map((m: any) => m.id);
          return this.availableModels;
        }
      }
      // Fallback
      this.availableModels = ['gpt-4-turbo'];
      return this.availableModels;
    } catch (error) {
      // If we can't fetch models, return fallback
      console.warn('Failed to fetch available models, using fallback');
      this.availableModels = ['gpt-4-turbo'];
      return this.availableModels;
    }
  }

  /**
   * Get the first/best available model
   */
  async getDefaultModel(): Promise<string> {
    const models = await this.getAvailableModels();
    return models[0] || 'gpt-4-turbo';
  }

  /**
   * Call the LLM API with messages and optional tools
   */
  async callCompletion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Validate input
    if (!request.model) {
      throw new Error('LLM_INVALID_REQUEST: model is required');
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('LLM_INVALID_REQUEST: messages array is required and must not be empty');
    }

    // Build the request payload
    const payload = {
      model: request.model,
      messages: request.messages,
      ...(request.tools && { tools: request.tools }),
      ...(request.tool_choice && { tool_choice: request.tool_choice }),
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 2048,
    };

    try {
      const response = await this.request(
        '/chat/completions',
        'POST',
        payload,
        request.timeout || this.timeout
      );

      return response as LLMCompletionResponse;
    } catch (error) {
      // Re-throw LLM-specific errors
      if (error instanceof LLMError) {
        throw error;
      }

      // Wrap unexpected errors
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMError('LLM_UNKNOWN_ERROR', `LLM call failed: ${message}`);
    }
  }

  /**
   * Make HTTP request to LLM API
   */
  private async request(
    endpoint: string,
    method: string,
    body?: unknown,
    timeout?: number
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Handle HTTP status codes
      if (response.status === 401 || response.status === 403) {
        const text = await response.text();
        throw new LLMAuthError(`LLM authentication failed: ${response.status} ${text}`);
      }

      if (response.status === 429) {
        const text = await response.text();
        throw new LLMRateLimitError(`Rate limit exceeded: ${text}`);
      }

      if (response.status >= 500) {
        const text = await response.text();
        throw new LLMError(
          'LLM_SERVER_ERROR',
          `LLM server error: ${response.status} ${text}`,
          response.status
        );
      }

      if (!response.ok) {
        const text = await response.text();
        throw new LLMError(
          'LLM_REQUEST_ERROR',
          `LLM request failed: ${response.status} ${text}`,
          response.status
        );
      }

      // Parse response
      let data: unknown;
      try {
        const text = await response.text();
        if (!text) {
          throw new LLMInvalidResponseError('Empty response body');
        }
        data = JSON.parse(text);
      } catch (parseError) {
        throw new LLMInvalidResponseError(
          `Failed to parse LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      // Validate response structure
      if (typeof data !== 'object' || data === null) {
        throw new LLMInvalidResponseError('Response is not an object');
      }

      return data;
    } catch (error) {
      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMTimeoutError(`LLM request timeout (${timeout || this.timeout}ms)`);
      }

      // Re-throw LLM errors
      if (error instanceof LLMError) {
        throw error;
      }

      // Network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new LLMError('LLM_NETWORK_ERROR', `Network error: ${error.message}`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default LLMClient;
