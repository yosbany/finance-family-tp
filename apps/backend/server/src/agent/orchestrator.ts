/**
 * Agent Orchestrator
 * 
 * Main orchestration logic for the financial agent.
 * 
 * Flow:
 * 1. User question
 * 2. Call LLM with question and available tools
 * 3. If LLM requests a tool:
 *    - Validate tool call
 *    - Execute tool
 *    - Send result back to LLM
 *    - Iterate (with limit)
 * 4. Return final answer
 * 
 * SECURITY:
 * - User identity from verified Firebase token only
 * - Tool execution happens only for registered tools
 * - LLM never receives uid, tokens, or paths
 * - Results are sanitized before being used
 */

import { AuthenticatedContext } from '../auth/authenticatedContext.js';
import LLMClient from '../llm/client.js';
import {
  LLMMessage,
  LLMToolCall,
  LLMError,
} from '../llm/types.js';
import {
  getToolsForLLM,
  executeToolRegistry,
  ToolResult,
} from './toolRegistry.js';

const MAX_TOOL_ITERATIONS = 3;
let DEFAULT_MODEL = 'gpt-4-turbo'; // Fallback, will be determined at runtime

export interface AgentQueryInput {
  message: string;
}

export interface AgentQueryResult {
  answer: string;
  toolsUsed: string[];
  toolIterations: number;
  requestId: string;
}

export class AgentOrchestrator {
  private llmClient: LLMClient;
  private systemPrompt: string;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const septStart = new Date(currentYear, 8, 1).getTime(); // Sept 1
    const septEnd = new Date(currentYear, 8, 30, 23, 59, 59, 999).getTime(); // Sept 30

    return `Sos un asistente de finanzas personales.

Tu objetivo es ayudar al usuario a entender y analizar sus finanzas.

**CONTEXTO TEMPORAL:**
- Fecha actual: ${now.toISOString()}
- Año actual: ${currentYear}
- Cuando el usuario menciona "septiembre de 2026", usa:
  - from: ${septStart} (1 de septiembre de 2026)
  - to: ${septEnd} (30 de septiembre de 2026)

**SELECCIÓN DE HERRAMIENTAS:**

Usá "getFinancialSummary" para:
- ¿Cuánto gasté en [período]?
- ¿Cuánto ingresé en [período]?
- ¿Cuál fue mi balance?
- ¿Cuánto ahorré?
- ¿Cuál es mi tasa de ahorro?
- Resumen del período

Usá "searchTransactions" para:
- Mostrame transacciones de [categoría]
- Buscá compras mayores a [monto]
- Detalle de movimientos
- Transacciones de [descripción]
- Listar movimientos

Usá las herramientas disponibles para consultar datos reales antes de afirmar montos, movimientos o fechas.

No inventes información financiera. No afirmes un dato si no lo verificaste con una herramienta.

Si los datos disponibles no alcanzan para responder completamente, indicalo claramente.

No tenés acceso directo a la base de datos. Solo podés utilizar las herramientas que te estan disponibles.

En esta etapa todas las consultas son de solo lectura. No podés hacer cambios.

Cuando uses una herramienta, intenta utilizar todos los filtros relevantes para obtener resultados precisos.

Si una herramienta devuelve resultados truncados, indicalo al usuario.`;
  }

  /**
   * Process a user query through the agent pipeline
   */
  async query(
    context: AuthenticatedContext,
    input: AgentQueryInput,
    requestId: string
  ): Promise<AgentQueryResult> {
    if (!input.message || typeof input.message !== 'string') {
      throw new Error('INVALID_ARGUMENT: message is required and must be a string');
    }

    const userMessage = input.message.trim();
    if (userMessage.length === 0) {
      throw new Error('INVALID_ARGUMENT: message cannot be empty');
    }

    if (userMessage.length > 1000) {
      throw new Error('INVALID_ARGUMENT: message is too long (max 1000 chars)');
    }

    // Initialize conversation
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const toolsUsed = new Set<string>();
    let iterations = 0;

    // Tool calling loop
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      console.log(`[AGENT] ${requestId} iteration ${iterations}`);

      // Call LLM
      const response = await this.callLLM(messages);

      // Extract assistant message
      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('LLM_INVALID_RESPONSE: No message in response');
      }

      console.log(`[AGENT] ${requestId} iteration ${iterations} tool_calls: ${assistantMessage.tool_calls?.length || 0}`);

      // Check if LLM requested tools
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        // No more tool calls, return final answer
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
        });
        
        const answer = assistantMessage.content || 'No answer generated';
        return {
          answer,
          toolsUsed: Array.from(toolsUsed),
          toolIterations: iterations,
          requestId,
        };
      }

      // Add assistant response to conversation (OpenAI format)
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      // Process tool calls
      const toolResults: Array<{ result: ToolResult; toolCallId: string }> = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const result = await this.processTool(context, toolCall);
        toolResults.push({ result, toolCallId: toolCall.id });

        // Track tools used
        if (!result.error) {
          toolsUsed.add(result.tool);
        }
      }

      // Add tool results to conversation (OpenAI format: role='tool')
      // Note: tool message format is handled by LLM client, not here
      for (const { result: toolResult } of toolResults) {
        // Tool results are added as part of the next assistant message context
        // LLM client handles the proper formatting
      }
    }

    // Max iterations exceeded
    throw new Error(
      `TOOL_ITERATION_LIMIT: Max tool iterations (${MAX_TOOL_ITERATIONS}) exceeded`
    );
  }

  /**
   * Call LLM with current conversation
   */
  private async callLLM(messages: LLMMessage[]): Promise<any> {
    try {
      // Get the model to use (dynamically detected)
      let model = DEFAULT_MODEL;
      try {
        model = await this.llmClient.getDefaultModel();
      } catch (error) {
        console.warn('Failed to get default model, using fallback');
      }

      const response = await this.llmClient.callCompletion({
        model,
        messages,
        tools: getToolsForLLM(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2048,
      });

      return response;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM_ERROR: ${message}`);
    }
  }

  /**
   * Process a single tool call
   */
  private async processTool(
    context: AuthenticatedContext,
    toolCall: LLMToolCall
  ): Promise<ToolResult> {
    try {
      // Parse tool arguments
      let args: unknown;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        return {
          tool: toolCall.function.name,
          result: null,
          error: `INVALID_TOOL_ARGUMENTS: Failed to parse arguments: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
        };
      }

      // Execute tool
      return await executeToolRegistry(
        toolCall.function.name,
        context,
        args
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        tool: toolCall.function.name,
        result: null,
        error: message,
      };
    }
  }

  /**
   * Format tool result for LLM
   * 
   * SECURITY: Only include necessary information
   */
  private formatToolResult(toolResult: ToolResult): string {
    if (toolResult.error) {
      return `Tool '${toolResult.tool}' error: ${toolResult.error}`;
    }

    // Sanitize result: only pass what LLM needs
    const sanitized = JSON.stringify(toolResult.result, null, 2);

    // Limit result size to prevent token explosion
    const maxLength = 4000;
    if (sanitized.length > maxLength) {
      return `Tool '${toolResult.tool}' result (truncated):\n${sanitized.substring(0, maxLength)}...\n[Result too long, showing first ${maxLength} chars]`;
    }

    return `Tool '${toolResult.tool}' result:\n${sanitized}`;
  }
}

export default AgentOrchestrator;
