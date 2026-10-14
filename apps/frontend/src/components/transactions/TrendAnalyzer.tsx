import { useState, useEffect } from 'react';
import { Transaction } from '../../types';
import {
  detectLifestyleChanges,
  calculateBehavioralProfile,
  generateProfileNarrative,
  LifestyleTrend,
  BehavioralProfile,
} from '../../services/trendAnalysis.service';

interface TrendAnalyzerProps {
  transactions: Transaction[];
}

export const TrendAnalyzer = ({ transactions }: TrendAnalyzerProps) => {
  const [trends, setTrends] = useState<LifestyleTrend[]>([]);
  const [profile, setProfile] = useState<BehavioralProfile | null>(null);
  const [narrative, setNarrative] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'profile' | 'trends'>('profile');

  useEffect(() => {
    try {
      const detectedTrends = detectLifestyleChanges(transactions);
      const behaviorProfile = calculateBehavioralProfile(transactions);
      const profileNarrative = generateProfileNarrative(behaviorProfile);

      setTrends(detectedTrends);
      setProfile(behaviorProfile);
      setNarrative(profileNarrative);
    } catch (error) {
      console.error('Error analyzing trends:', error);
    }
  }, [transactions]);

  if (!profile) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 px-4 py-3 font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          👤 Perfil
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`flex-1 px-4 py-3 font-medium transition-colors ${
            activeTab === 'trends'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          🔍 Tendencias
          {trends.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {trends.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono overflow-auto max-h-96">
              {narrative}
            </pre>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-3">
            {trends.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No se detectaron cambios significativos de estilo de vida
              </p>
            ) : (
              trends.map((trend) => (
                <div
                  key={trend.id}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {trend.title}
                    </h3>
                    <span className="text-xs font-mono bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded">
                      {(trend.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {trend.description}
                  </p>

                  <div className="space-y-1">
                    {trend.indicators.map((indicator, idx) => (
                      <p key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                        • {indicator}
                      </p>
                    ))}
                  </div>

                  {trend.potentialAnnualSavings > 0 && (
                    <p className="mt-3 text-sm font-semibold text-green-600 dark:text-green-400">
                      💰 Potencial ahorro anual: ${trend.potentialAnnualSavings.toFixed(2)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
