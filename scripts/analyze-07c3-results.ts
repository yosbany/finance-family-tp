/**
 * FASE 07C3 - Analysis of Human Validation Results
 * 
 * Processes human decisions and generates final metrics
 * 
 * Execute after completing validation:
 * cd apps/backend/server && npx tsx ../../scripts/analyze-07c3-results.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface UserDecision {
  caseId: string;
  decision: 'CORRECT' | 'INCORRECT' | 'UNCERTAIN' | null;
  correctCategory?: string;
  notes?: string;
}

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

interface SourceMetrics {
  source: string;
  reviewed: number;
  correct: number;
  incorrect: number;
  uncertain: number;
  acceptanceRate: number | null;
  details?: any;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('FASE 07C3 - ANALYSIS OF HUMAN VALIDATION RESULTS');
    console.log('='.repeat(70) + '\n');

    // Load validation data
    const validationDataPath = path.join(__dirname, '../docs/FASE_07C3_VALIDATION_DATA.json');
    const feedbackPath = path.join(__dirname, '../docs/FASE_07C3_HUMAN_FEEDBACK.json');

    if (!fs.existsSync(validationDataPath)) {
      console.error('❌ Validation data not found. Run scripts/validate-07c3.ts first');
      process.exit(1);
    }

    if (!fs.existsSync(feedbackPath)) {
      console.error('❌ Human feedback not found. Complete validation first');
      process.exit(1);
    }

    const validationData: { samples: ValidationSample[] } = JSON.parse(
      fs.readFileSync(validationDataPath, 'utf-8')
    );
    const feedbackData: { responses: UserDecision[] } = JSON.parse(
      fs.readFileSync(feedbackPath, 'utf-8')
    );

    console.log('📊 STEP 1: Loading validation data...\n');
    console.log(`  Samples: ${validationData.samples.length}`);
    console.log(`  Decisions: ${feedbackData.responses.length}\n`);

    // 2. Calculate metrics per source
    console.log('🔄 STEP 2: Calculating metrics per source...\n');

    const sourceMap = new Map<string, ValidationSample[]>();
    for (const sample of validationData.samples) {
      if (!sourceMap.has(sample.source)) {
        sourceMap.set(sample.source, []);
      }
      sourceMap.get(sample.source)!.push(sample);
    }

    const metricsPerSource: SourceMetrics[] = [];

    for (const [source, samples] of sourceMap.entries()) {
      console.log(`  Processing ${source}...`);

      const correct = samples.filter(s => {
        const decision = feedbackData.responses.find(r => r.caseId === s.caseId);
        return decision?.decision === 'CORRECT';
      }).length;

      const incorrect = samples.filter(s => {
        const decision = feedbackData.responses.find(r => r.caseId === s.caseId);
        return decision?.decision === 'INCORRECT';
      }).length;

      const uncertain = samples.filter(s => {
        const decision = feedbackData.responses.find(r => r.caseId === s.caseId);
        return decision?.decision === 'UNCERTAIN';
      }).length;

      const reviewed = correct + incorrect + uncertain;
      const decisive = correct + incorrect;
      const acceptanceRate = decisive > 0 ? (correct / decisive) * 100 : null;

      const metrics: SourceMetrics = {
        source,
        reviewed,
        correct,
        incorrect,
        uncertain,
        acceptanceRate
      };

      // Special analysis for RULES: by confidence bucket
      if (source === 'RULES') {
        const byBucket = new Map<string, { correct: number; incorrect: number }>();

        for (const sample of samples) {
          const bucket = sample.extraInfo?.confidenceBucket || 'unknown';
          if (!byBucket.has(bucket)) {
            byBucket.set(bucket, { correct: 0, incorrect: 0 });
          }

          const decision = feedbackData.responses.find(r => r.caseId === sample.caseId);
          if (decision?.decision === 'CORRECT') {
            byBucket.get(bucket)!.correct++;
          } else if (decision?.decision === 'INCORRECT') {
            byBucket.get(bucket)!.incorrect++;
          }
        }

        metrics.details = {
          byConfidenceBucket: Array.from(byBucket.entries()).map(([bucket, counts]) => ({
            bucket,
            correct: counts.correct,
            incorrect: counts.incorrect,
            acceptanceRate:
              counts.correct + counts.incorrect > 0
                ? (counts.correct / (counts.correct + counts.incorrect)) * 100
                : null
          }))
        };
      }

      // Special analysis for HISTORICAL_CONSENSUS: consensus vs acceptance
      if (source === 'HISTORICAL_CONSENSUS') {
        const consensusAnalysis: any[] = [];

        for (const sample of samples) {
          const consensus = sample.extraInfo?.consensus || 0;
          const decision = feedbackData.responses.find(r => r.caseId === sample.caseId);

          consensusAnalysis.push({
            caseId: sample.caseId,
            consensus: consensus * 100,
            accepted: decision?.decision === 'CORRECT'
          });
        }

        metrics.details = {
          consensusAnalysis
        };
      }

      metricsPerSource.push(metrics);
    }

    // 3. Generate final table
    console.log('\n📋 STEP 3: Generating final table...\n');

    console.log('='.repeat(70));
    console.log('FINAL RESULTS TABLE');
    console.log('='.repeat(70) + '\n');

    console.log(
      'SOURCE'.padEnd(25) +
        'REVIEWED'.padEnd(12) +
        'CORRECT'.padEnd(12) +
        'INCORRECT'.padEnd(12) +
        'UNCERTAIN'.padEnd(12) +
        'ACCEPTANCE %'
    );
    console.log('-'.repeat(85));

    for (const metric of metricsPerSource) {
      const acceptanceStr = metric.acceptanceRate !== null ? metric.acceptanceRate.toFixed(1) + '%' : '-';
      console.log(
        metric.source.padEnd(25) +
          metric.reviewed.toString().padEnd(12) +
          metric.correct.toString().padEnd(12) +
          metric.incorrect.toString().padEnd(12) +
          metric.uncertain.toString().padEnd(12) +
          acceptanceStr
      );

      // Special details
      if (metric.details?.byConfidenceBucket) {
        console.log('  └─ By Confidence Bucket:');
        for (const bucket of metric.details.byConfidenceBucket) {
          const bucketAcceptance = bucket.acceptanceRate !== null ? bucket.acceptanceRate.toFixed(1) + '%' : '-';
          console.log(
            `     ${bucket.bucket.padEnd(15)} correct: ${bucket.correct} incorrect: ${bucket.incorrect} acceptance: ${bucketAcceptance}`
          );
        }
      }

      if (metric.details?.consensusAnalysis) {
        const avgConsensus =
          metric.details.consensusAnalysis.reduce((sum: number, item: any) => sum + item.consensus, 0) /
          metric.details.consensusAnalysis.length;
        const avgAccepted =
          (metric.details.consensusAnalysis.filter((item: any) => item.accepted).length /
            metric.details.consensusAnalysis.length) *
          100;
        console.log(
          `  └─ Consensus Analysis: Avg consensus ${avgConsensus.toFixed(1)}%, Avg accepted ${avgAccepted.toFixed(1)}%`
        );
      }
    }

    // 4. Recommendations
    console.log('\n' + '='.repeat(70));
    console.log('RECOMMENDATIONS FOR FASE 07C4');
    console.log('='.repeat(70) + '\n');

    const recommendations: string[] = [];

    for (const metric of metricsPerSource) {
      const acceptance = metric.acceptanceRate ?? 0;

      if (acceptance >= 90) {
        recommendations.push(
          `✅ ${metric.source}: STRONG_SUGGESTION (${acceptance.toFixed(1)}% acceptance) → Show in UI with minimal friction`
        );
      } else if (acceptance >= 70) {
        recommendations.push(
          `⚠️  ${metric.source}: REVIEW_REQUIRED (${acceptance.toFixed(1)}% acceptance) → Show in UI but require confirmation`
        );
      } else if (acceptance >= 50) {
        recommendations.push(
          `🔍 ${metric.source}: LOW_CONFIDENCE (${acceptance.toFixed(1)}% acceptance) → Show only with high friction or not at all`
        );
      } else {
        recommendations.push(`❌ ${metric.source}: NOT_RECOMMENDED (${acceptance.toFixed(1)}% acceptance) → Do not use`);
      }
    }

    for (const rec of recommendations) {
      console.log(rec);
    }

    // 5. Save results
    console.log('\n💾 STEP 4: Saving final report...\n');

    const finalReport = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C3',
      status: 'ANALYSIS_COMPLETE',
      metrics: metricsPerSource,
      recommendations: recommendations,
      nextPhase: 'FASE_07C4_DESIGN'
    };

    const reportPath = path.join(__dirname, '../docs/FASE_07C3_RESULTADOS_FINALES.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

    console.log(`📁 Final report saved to: docs/FASE_07C3_RESULTADOS_FINALES.json\n`);

    console.log('='.repeat(70));
    console.log('✅ FASE 07C3 ANALYSIS COMPLETE');
    console.log('='.repeat(70) + '\n');

    console.log('Next: Review recommendations and design FASE 07C4 UI accordingly\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
