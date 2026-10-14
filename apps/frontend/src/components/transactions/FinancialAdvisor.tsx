import { useState, useEffect } from 'react';
import { Transaction, Category } from '../../types';
import {
  detectAnomalies,
  detectSpendingPatterns,
  generateRecommendations,
  predictCashflow,
  generateAnalysisSummary,
  AnomalyResult,
  SpendingPattern,
  Recommendation,
  CashflowPrediction,
} from '../../services/expenseAnalysis.service';
import { useModal } from '../../hooks/useModal';

interface FinancialAdvisorProps {
  transactions: Transaction[];
  categories: Category[];
}

export const FinancialAdvisor = ({ transactions, categories }: FinancialAdvisorProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'patterns' | 'recommendations' | 'forecast'>('overview');
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [patterns, setPatterns] = useState<SpendingPattern[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [forecast, setForecast] = useState<CashflowPrediction[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { ModalComponent } = useModal();

  useEffect(() => {
    const analyze = () => {
      try {
        setLoading(true);

        const anom = detectAnomalies(transactions, categories);
        const patt = detectSpendingPatterns(transactions, categories);
        const recs = generateRecommendations(transactions, categories);
        const pred = predictCashflow(transactions);
        const sum = generateAnalysisSummary(transactions, categories);

        setAnomalies(anom);
        setPatterns(patt);
        setRecommendations(recs);
        setForecast(pred);
        setSummary(sum);
      } catch (error) {
        console.error('Error in financial analysis:', error);
      } finally {
        setLoading(false);
      }
    };

    if (transactions.length > 0) {
      analyze();
    }
  }, [transactions, categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 p-4">
          {[
            { id: 'overview', label: '📊 Overview', icon: '📊' },
            { id: 'anomalies', label: '⚠️ Anomalías', icon: '⚠️', count: anomalies.length },
            { id: 'patterns', label: '📈 Patrones', icon: '📈', count: patterns.length },
            { id: 'recommendations', label: '💡 Recomendaciones', icon: '💡', count: recommendations.length },
            { id: 'forecast', label: '🔮 Predicción', icon: '🔮', count: forecast.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm whitespace-pre-wrap overflow-auto max-h-96">
              {summary}
            </pre>
          </div>
        )}

        {/* Anomalies */}
        {activeTab === 'anomalies' && (
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <p className="text-gray-500">No se detectaron anomalías</p>
            ) : (
              anomalies.map((anom) => (
                <div
                  key={anom.transactionId}
                  className={`p-4 rounded-lg border ${
                    anom.severity === 'high'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : anom.severity === 'medium'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {anom.description}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {anom.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ${Math.abs(anom.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Z-score: {anom.zScore.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Patterns */}
        {activeTab === 'patterns' && (
          <div className="space-y-3">
            {patterns.length === 0 ? (
              <p className="text-gray-500">No se detectaron patrones</p>
            ) : (
              patterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {pattern.category}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Trend: <span className="font-mono">{pattern.trend}</span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Promedio: ${pattern.average.toFixed(2)}/mes
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          pattern.changePercent > 0
                            ? 'text-red-600'
                            : pattern.changePercent < 0
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {pattern.changePercent > 0 ? '+' : ''}
                        {pattern.changePercent.toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        Vs mes anterior: ${pattern.lastMonth.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <p className="text-gray-500">No hay recomendaciones en este momento</p>
            ) : (
              recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {rec.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {rec.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded">
                        {(rec.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  {rec.potentialSavings > 0 && (
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      💰 Potencial ahorro: ${rec.potentialSavings.toFixed(2)}
                    </p>
                  )}
                  {rec.actionItems.length > 0 && (
                    <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                      {rec.actionItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Forecast */}
        {activeTab === 'forecast' && (
          <div className="space-y-3">
            {forecast.length === 0 ? (
              <p className="text-gray-500">No hay datos suficientes para predecir</p>
            ) : (
              forecast.map((pred, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {pred.month}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Predicción: ${pred.predictedTotal.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Intervalo de confianza: ${pred.confidenceInterval.low.toFixed(2)} - $
                        {pred.confidenceInterval.high.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {/* Simple bar visualization */}
                  <div className="mt-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600"
                      style={{
                        width: `${Math.min(
                          (pred.predictedTotal / (pred.confidenceInterval.high * 1.5)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ModalComponent />
    </div>
  );
};
