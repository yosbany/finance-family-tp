import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * FASE 07C3 - Human Validation Canvas
 * 
 * Interactive tool for reviewing and validating classification suggestions
 * from all sources: RULES, HISTORICAL_EXACT, HISTORICAL_CONSENSUS, AGENT
 * 
 * Features:
 * - Display samples by source
 * - Record decisions (CORRECT/INCORRECT/UNCERTAIN)
 * - Calculate metrics in real-time
 * - Export results for analysis
 */

interface ValidationSample {
  caseId: string;
  source: 'RULES' | 'HISTORICAL_EXACT' | 'HISTORICAL_CONSENSUS' | 'AGENT';
  merchant: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  extraInfo?: {
    sampleSize?: number;
    consensus?: number;
    matchedKeywords?: string[];
    reasoning?: string;
    confidenceBucket?: string;
  };
}

interface UserDecision {
  caseId: string;
  decision: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN' | null;
  correctCategory?: string;
  notes?: string;
}

interface Metrics {
  source: string;
  reviewed: number;
  correct: number;
  incorrect: number;
  uncertain: number;
  acceptanceRate: number | null;
}

const PLACEHOLDER_SAMPLES: ValidationSample[] = [
  {
    caseId: 'RULES_1',
    source: 'RULES',
    merchant: 'MERCADO PAGO BUENOS AIRES',
    categoryId: 'groceries',
    categoryName: 'Alimentos y Bebidas',
    confidence: 0.51,
    extraInfo: {
      confidenceBucket: '0.50-0.74',
      matchedKeywords: ['MERCADO', 'PAGO']
    }
  },
  {
    caseId: 'HIST_EXACT_1',
    source: 'HISTORICAL_EXACT',
    merchant: 'FARMACIA DEL DR',
    categoryId: 'pharmacy',
    categoryName: 'Salud y Bienestar',
    confidence: 1.0,
    extraInfo: {
      sampleSize: 8,
      consensus: 1.0
    }
  },
  {
    caseId: 'AGENT_1',
    source: 'AGENT',
    merchant: 'Tienda de deportes',
    categoryId: 'sports',
    categoryName: 'Deportes y Recreación',
    confidence: 0.92,
    extraInfo: {
      reasoning: 'Términos de retail deportivo con contexto claro de compra minorista'
    }
  }
];

export default function Fase07C3Validator() {
  const [samples] = useState<ValidationSample[]>(PLACEHOLDER_SAMPLES);
  const [decisions, setDecisions] = useState<Map<string, UserDecision>>(new Map());
  const [currentTab, setCurrentTab] = useState('RULES');
  const [metrics, setMetrics] = useState<Metrics[]>([]);

  const sourceOrder = {
    RULES: 1,
    HISTORICAL_EXACT: 2,
    HISTORICAL_CONSENSUS: 3,
    AGENT: 4
  };

  const getSamples = (source: string) =>
    samples
      .filter(s => s.source === source)
      .sort((a, b) => {
        const numA = parseInt(a.caseId.split('_').pop() || '0');
        const numB = parseInt(b.caseId.split('_').pop() || '0');
        return numA - numB;
      });

  const handleDecision = (caseId: string, decision: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN') => {
    const existing = decisions.get(caseId) || { caseId, decision: null };
    setDecisions(new Map(decisions.set(caseId, { ...existing, decision })));
    updateMetrics();
  };

  const handleCorrectionCategory = (caseId: string, category: string) => {
    const existing = decisions.get(caseId) || { caseId, decision: null };
    setDecisions(new Map(decisions.set(caseId, { ...existing, correctCategory: category })));
  };

  const updateMetrics = () => {
    const sourceList = ['RULES', 'HISTORICAL_EXACT', 'HISTORICAL_CONSENSUS', 'AGENT'];
    const newMetrics = sourceList.map(source => {
      const sourceSamples = getSamples(source);
      const sourceDecisions = sourceSamples.map(s => decisions.get(s.caseId));

      const reviewed = sourceDecisions.filter(d => d?.decision).length;
      const correct = sourceDecisions.filter(d => d?.decision === 'CORRECT').length;
      const incorrect = sourceDecisions.filter(d => d?.decision === 'INCORRECT').length;
      const uncertain = sourceDecisions.filter(d => d?.decision === 'UNCERTAIN').length;

      const decisive = correct + incorrect;
      const acceptanceRate = decisive > 0 ? (correct / decisive) * 100 : null;

      return {
        source,
        reviewed,
        correct,
        incorrect,
        uncertain,
        acceptanceRate
      };
    });

    setMetrics(newMetrics);
  };

  const renderSample = (sample: ValidationSample) => {
    const decision = decisions.get(sample.caseId);
    const isDecided = decision?.decision !== null && decision?.decision !== undefined;

    return (
      <Card key={sample.caseId} className={`mb-4 ${isDecided ? 'bg-blue-50' : ''}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{sample.caseId}</CardTitle>
              <CardDescription>
                {sample.merchant} → <strong>{sample.categoryName}</strong>
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{(sample.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-500">confidence</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Extra info */}
          {sample.extraInfo && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
              {sample.extraInfo.confidenceBucket && (
                <div>Bucket: {sample.extraInfo.confidenceBucket}</div>
              )}
              {sample.extraInfo.sampleSize && (
                <div>Histórico: {sample.extraInfo.sampleSize} antecedentes</div>
              )}
              {sample.extraInfo.consensus !== undefined && (
                <div>Consenso: {(sample.extraInfo.consensus * 100).toFixed(0)}%</div>
              )}
              {sample.extraInfo.matchedKeywords && sample.extraInfo.matchedKeywords.length > 0 && (
                <div>Keywords: {sample.extraInfo.matchedKeywords.join(', ')}</div>
              )}
              {sample.extraInfo.reasoning && (
                <div className="italic mt-2">{sample.extraInfo.reasoning}</div>
              )}
            </div>
          )}

          {/* Decision buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['CORRECT', 'INCORRECT', 'UNCERTAIN'].map(option => (
              <Button
                key={option}
                variant={decision?.decision === option ? 'default' : 'outline'}
                className="w-full"
                onClick={() => handleDecision(sample.caseId, option as any)}
              >
                {option}
              </Button>
            ))}
          </div>

          {/* Correction category input (if INCORRECT) */}
          {decision?.decision === 'INCORRECT' && (
            <div className="p-3 bg-red-50 rounded">
              <label className="text-sm font-medium">Categoría correcta:</label>
              <input
                type="text"
                className="w-full mt-2 p-2 border rounded"
                placeholder="ej: transportation, entertainment"
                value={decision?.correctCategory || ''}
                onChange={(e) => handleCorrectionCategory(sample.caseId, e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const allDecided = samples.every(s => decisions.get(s.caseId)?.decision);

  return (
    <div className="w-full h-full p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">FASE 07C3</h1>
          <h2 className="text-2xl text-gray-700 mb-4">Validación Humana de Sugerencias</h2>
          <p className="text-gray-600 mb-4">
            Revisa cada sugerencia y marca como CORRECT, INCORRECT, o UNCERTAIN.
            Tus decisiones determinarán la confiabilidad de cada mecanismo.
          </p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(decisions.size / samples.length) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-600">
            {decisions.size} / {samples.length} revisados
            {allDecided && <span className="ml-2 text-green-600 font-bold">✓ COMPLETADO</span>}
          </div>
        </div>

        {/* Tabs for each source */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            {['RULES', 'HISTORICAL_EXACT', 'HISTORICAL_CONSENSUS', 'AGENT'].map(source => (
              <TabsTrigger key={source} value={source}>
                {source}
                {getSamples(source).length > 0 && (
                  <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                    {getSamples(source).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {['RULES', 'HISTORICAL_EXACT', 'HISTORICAL_CONSENSUS', 'AGENT'].map(source => (
            <TabsContent key={source} value={source}>
              <div>
                {getSamples(source).map(sample => renderSample(sample))}
                {getSamples(source).length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-gray-500 text-center">
                        No hay muestras disponibles para {source}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas en Tiempo Real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Fuente</th>
                    <th className="text-center p-2">Revisados</th>
                    <th className="text-center p-2">Correctos</th>
                    <th className="text-center p-2">Incorrectos</th>
                    <th className="text-center p-2">Inciertos</th>
                    <th className="text-center p-2">Acceptance %</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(m => (
                    <tr key={m.source} className="border-t hover:bg-blue-50">
                      <td className="p-2 font-medium">{m.source}</td>
                      <td className="text-center p-2">{m.reviewed}</td>
                      <td className="text-center p-2 text-green-600">{m.correct}</td>
                      <td className="text-center p-2 text-red-600">{m.incorrect}</td>
                      <td className="text-center p-2 text-yellow-600">{m.uncertain}</td>
                      <td className="text-center p-2 font-bold">
                        {m.acceptanceRate !== null ? `${m.acceptanceRate.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Export button */}
        <div className="mt-8 text-center">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700"
            disabled={!allDecided}
          >
            {allDecided ? '✓ Exportar Resultados' : 'Completa la revisión para exportar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
