/**
 * Agent Query Development Component
 * 
 * Minimal UI for testing the financial agent.
 * This is a development/testing interface for FASE 05.
 */

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  toolIterations: number;
  requestId: string;
}

export function AgentQueryDev() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!user) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Get the Firebase ID token
      const token = await user.getIdToken();

      const res = await fetch('/api/agent/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || `Error: ${res.status}`);
        return;
      }

      setResponse(data);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Financial Agent - Development Test
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Query your financial data using natural language
          </p>
        </div>

        {/* Query Input */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Your Question
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your transactions... (Ctrl+Enter to send)"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              rows={4}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleQuery}
            disabled={loading || !message.trim()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Processing...
              </>
            ) : (
              'Send Query'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-6">
            {/* Answer */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                Answer
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {response.answer}
              </p>
            </div>

            {/* Tools Used */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Tools Used:
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 ml-2">
                    {response.toolsUsed.length > 0
                      ? response.toolsUsed.join(', ')
                      : 'None (no tools required)'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Iterations:
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 ml-2">
                    {response.toolIterations}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Request ID:
                  </span>
                  <code className="text-xs text-slate-600 dark:text-slate-400 ml-2 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded font-mono">
                    {response.requestId}
                  </code>
                </div>
              </div>
            </div>

            {/* Example Queries */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Example Queries
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>• What type of information can you consult from my finances?</li>
                <li>• Show me my transactions from September 2026</li>
                <li>• Did I have any transaction over $10,000 in September?</li>
                <li>• Search for movements related to supermarket</li>
                <li>• What transactions do I have from last week?</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentQueryDev;
