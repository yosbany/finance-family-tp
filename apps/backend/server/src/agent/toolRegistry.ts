/**
 * Tool Registry
 * 
 * Centralized registry of available tools for the agent.
 * Currently only searchTransactions is available.
 * 
 * SECURITY:
 * - Only explicitly registered tools can be executed
 * - Unknown tools are rejected with UNKNOWN_TOOL
 * - No dynamic function execution
 * - No eval()
 */

import { AuthenticatedContext } from '../auth/authenticatedContext.js';
import {
  searchTransactions,
  SearchTransactionsInput,
  SearchTransactionsOutput,
} from '../finance/tools/searchTransactions.js';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  tool: string;
  result: unknown;
  error?: string;
}

/**
 * Tool implementations
 * Each tool receives the authenticated context and validates its own input
 */
type ToolExecutor = (
  context: AuthenticatedContext,
  args: unknown
) => Promise<unknown>;

const toolImplementations: Record<string, ToolExecutor> = {
  searchTransactions: async (context: AuthenticatedContext, args: unknown) => {
    return searchTransactions(context, args);
  },
};

/**
 * Tool schema for LLM
 * Defines the interface that the LLM sees
 */
export const toolSchemas: ToolDefinition[] = [
  {
    name: 'searchTransactions',
    description:
      'Search your financial transactions with optional filters. Returns paginated results with transaction details and metadata.',
    schema: {
      type: 'object',
      properties: {
        from: {
          type: 'number',
          description: 'Start date (Unix timestamp in milliseconds). Inclusive.',
        },
        to: {
          type: 'number',
          description: 'End date (Unix timestamp in milliseconds). Inclusive.',
        },
        accountId: {
          type: 'string',
          description: 'Filter by account ID.',
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category ID.',
        },
        type: {
          type: 'string',
          enum: ['income', 'expense', 'transfer'],
          description: 'Filter by transaction type.',
        },
        currency: {
          type: 'string',
          enum: ['UYU', 'USD'],
          description: 'Filter by currency.',
        },
        description: {
          type: 'string',
          description: 'Filter transactions by description (substring search, case-insensitive).',
        },
        minAmount: {
          type: 'number',
          description: 'Filter by minimum amount (absolute value).',
        },
        maxAmount: {
          type: 'number',
          description: 'Filter by maximum amount (absolute value).',
        },
        status: {
          type: 'string',
          enum: ['pending', 'classified', 'verified'],
          description: 'Filter by classification status.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 50, max 500).',
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (default 0).',
        },
      },
    },
  },
];

/**
 * Get tool schema for LLM as JSON Schema format
 */
export function getToolsForLLM(): Array<{
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
}> {
  return toolSchemas.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    },
  }));
}

/**
 * Check if a tool exists in the registry
 */
export function hasToolRegistry(toolName: string): boolean {
  return toolName in toolImplementations;
}

/**
 * Execute a tool from the registry
 * 
 * SECURITY:
 * - Only registered tools can be executed
 * - Unknown tools return error
 * - Each tool validates its input
 */
export async function executeToolRegistry(
  toolName: string,
  context: AuthenticatedContext,
  args: unknown
): Promise<ToolResult> {
  // Check if tool exists
  if (!hasToolRegistry(toolName)) {
    return {
      tool: toolName,
      result: null,
      error: `UNKNOWN_TOOL: Tool '${toolName}' not found in registry`,
    };
  }

  try {
    const executor = toolImplementations[toolName];
    const result = await executor(context, args);

    return {
      tool: toolName,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      tool: toolName,
      result: null,
      error: message,
    };
  }
}

export default {
  toolSchemas,
  getToolsForLLM,
  hasToolRegistry,
  executeToolRegistry,
};
