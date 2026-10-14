import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  toolIterations: number;
  requestId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolsUsed?: string[];
  toolIterations?: number;
  error?: boolean;
}

const SUGGESTIONS = [
  '¿Cuánto gasté el mes pasado?',
  'Mostrame los movimientos de septiembre 2026',
  '¿Tuve algún gasto mayor a $10.000?',
  'Buscá movimientos de supermercado',
  '¿Qué puedo consultar de mis finanzas?',
];

export function AgentQueryDev() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!user) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', text: trimmed },
        { id: crypto.randomUUID(), role: 'assistant', text: 'Tenés que iniciar sesión para consultar.', error: true },
      ]);
      return;
    }

    setMessage('');
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }]);
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const apiBase = import.meta.env.VITE_FINANCE_API_URL || 'https://service.nrdonline.site';
      const res = await fetch(`${apiBase}/api/agent/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Error ${res.status}`);
      }

      const reply = data as AgentResponse;
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: reply.answer,
          toolsUsed: reply.toolsUsed,
          toolIterations: reply.toolIterations,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: err instanceof Error ? err.message : 'No se pudo consultar el asistente.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asistente financiero</h1>
          <p className="text-sm text-gray-400">Preguntá por tus movimientos. Enter envía, Shift+Enter hace un salto de línea.</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            Limpiar
          </button>
        )}
      </div>

      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800/40 p-4 md:p-6"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end">
            <p className="mb-3 text-sm text-gray-400">Probá con una de estas preguntas:</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left text-sm text-gray-200 hover:border-green-600 hover:bg-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(item => (
              <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-green-600 text-white'
                      : item.error
                        ? 'border border-red-800 bg-red-950/60 text-red-200'
                        : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                  {item.toolsUsed && item.toolsUsed.length > 0 && (
                    <p className="mt-2 text-xs text-gray-300">
                      Consultó: {item.toolsUsed.join(', ')}
                      {typeof item.toolIterations === 'number' ? ` · ${item.toolIterations} pasos` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-700 px-4 py-3 text-sm text-gray-300">
                  Consultando tus datos...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="mt-4 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(message);
        }}
      >
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu pregunta..."
          rows={2}
          disabled={loading}
          className="min-h-[3.5rem] flex-1 resize-none rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="h-14 shrink-0 rounded-xl bg-green-600 px-6 font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {loading ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

export default AgentQueryDev;
