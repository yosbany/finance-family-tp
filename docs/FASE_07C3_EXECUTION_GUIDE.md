# FASE 07C3 — Execution Guide

**Last Updated**: Oct 3, 2026  
**Status**: READY FOR EXECUTION

---

## Overview

FASE 07C3 measures the REAL quality of classification suggestions before building UI or making changes to thresholds.

**Duration**: ~1-2 hours for complete validation  
**Output**: Metrics per source + recommendations for FASE 07C4

---

## Prerequisites

- [x] FASE 07C2 completed (FASE_07C2_RESULTADOS_REALES.json exists)
- [x] Firebase access on VPS or local dev
- [x] `scripts/validate-07c3.ts` and `scripts/analyze-07c3-results.ts` ready
- [x] This guide

---

## Step 1: Generate Validation Samples

### Command

```bash
cd /Users/yosbanytejas/Documents/finance-family
FIREBASE_SA_PATH=/etc/finance-family-api/firebase-service-account.json \
  npx tsx scripts/validate-07c3.ts
```

### Output

- **Terminal**: Summary of samples extracted
- **File**: `docs/FASE_07C3_VALIDATION_DATA.json`
  - Structured list of cases to validate
  - Includes all sources (RULES, HISTORICAL_EXACT, HISTORICAL_CONSENSUS, AGENT)
  - ~30-40 total cases (max 10 per source)

### Verify

```bash
cat docs/FASE_07C3_VALIDATION_DATA.json | jq '.summary'
```

Expected output:

```json
{
  "totalSamples": 39,
  "bySource": {
    "RULES": 10,
    "HISTORICAL_EXACT": 10,
    "HISTORICAL_CONSENSUS": 10,
    "AGENT": 9
  }
}
```

---

## Step 2: Open Validation Canvas

### Local Development

```bash
# The canvas is already available as:
# FASE_07C3_VALIDATOR.canvas.tsx

# Open in Cursor IDE:
# 1. Open the .canvas.tsx file
# 2. Cursor will automatically render it as an interactive Canvas
```

### Features

- **Tabs by source**: RULES | HISTORICAL_EXACT | HISTORICAL_CONSENSUS | AGENT
- **Progress bar**: Shows completion status
- **Sample cards**: Merchant + suggested category + confidence + extra info
- **Decision buttons**: CORRECT | INCORRECT | UNCERTAIN
- **Correction input**: For INCORRECT cases, specify the right category
- **Real-time metrics**: Table updates as you decide

---

## Step 3: Review and Validate

### For Each Sample

1. **Read the merchant/description**
2. **Review the suggested category**
3. **Check confidence score and extra info**
4. **Make decision**:
   - ✅ **CORRECT**: The categorization is right
   - ❌ **INCORRECT**: The categorization is wrong (provide correct category)
   - ❓ **UNCERTAIN**: Cannot confirm

### Tips

- Focus on variety: RULES samples across confidence buckets
- Trust your judgment: These were pending transactions
- No ground truth needed: Your assessment IS the ground truth
- Take notes if helpful (optional)

---

## Step 4: Export Results

### When Complete

Once you've reviewed all samples (progress bar = 100%):

1. Click **"Exportar Resultados"** button
2. This saves decisions to `docs/FASE_07C3_HUMAN_FEEDBACK.json`

### File Format

```json
{
  "timestamp": "2026-10-03T...",
  "reviewer": "user@example.com",
  "responses": [
    {
      "caseId": "RULES_1",
      "decision": "CORRECT",
      "correctCategory": null,
      "notes": ""
    },
    {
      "caseId": "RULES_2",
      "decision": "INCORRECT",
      "correctCategory": "transportation",
      "notes": "Esta es una compra de repuestos, no servicios"
    },
    {
      "caseId": "HIST_EXACT_1",
      "decision": "UNCERTAIN",
      "correctCategory": null,
      "notes": "No puedo verificar sin más contexto"
    }
  ]
}
```

---

## Step 5: Analyze Results

### Command

```bash
cd /Users/yosbanytejas/Documents/finance-family
npx tsx scripts/analyze-07c3-results.ts
```

### Output

**Terminal output**:
```
==================== FINAL RESULTS TABLE ====================
SOURCE                  REVIEWED  CORRECT  INCORRECT  UNCERTAIN  ACCEPTANCE %
RULES                        10        9          1          0            90.0%
HISTORICAL_EXACT             10       10          0          0           100.0%
HISTORICAL_CONSENSUS         10        8          2          0            80.0%
AGENT                         9        7          1          1            87.5%
```

**File**: `docs/FASE_07C3_RESULTADOS_FINALES.json`
- Detailed metrics
- Acceptance rates by confidence bucket (for RULES)
- Recommendations for FASE 07C4

---

## Interpretation Guide

### Acceptance Rate

Calculated as:

```
acceptanceRate = CORRECT / (CORRECT + INCORRECT)

Note: UNCERTAIN cases are excluded from the denominator
```

### What the numbers mean

| Acceptance Rate | Interpretation | Recommendation |
|-----------------|-----------------|-----------------|
| **≥ 90%** | Very reliable | STRONG_SUGGESTION: Show in UI with minimal confirmation |
| **70-89%** | Good reliability | REVIEW_REQUIRED: Show in UI but ask for confirmation |
| **50-69%** | Moderate | LOW_CONFIDENCE: Show only if user asks, not suggested |
| **< 50%** | Unreliable | NOT_RECOMMENDED: Do not use in UI |

### RULES: By Confidence Bucket

If acceptance differs by bucket:

- **0.50-0.74 has < 70% acceptance**: Consider raising RULES threshold to 0.75
- **0.90-1.00 has 100% acceptance**: Can be treated as STRONG_SUGGESTION
- **Buckets vary widely**: Threshold 0.5 may need adjustment

### HISTORICAL_EXACT

- If acceptance = 100%: Can auto-show as STRONG_SUGGESTION
- If acceptance < 90%: Indicates inconsistent historical data, needs review

### HISTORICAL_CONSENSUS

- Correlate consensus % with acceptance %
- Example: Does 90% consensus = 90% human acceptance?
- Use to determine optimal consensus threshold

### AGENT (LLM)

- Check for INVALID categories (input outside schema)
- If high invalid rate: Improve JSON Schema constraints
- Acceptance rate = measure of LLM usefulness

---

## Troubleshooting

### ❌ No FASE_07C3_VALIDATION_DATA.json found

**Solution**: Run Step 1 first
```bash
npx tsx scripts/validate-07c3.ts
```

### ❌ Canvas won't load

**Solution**: Ensure file is in project root with `.canvas.tsx` extension

### ❌ Export button disabled

**Solution**: Complete all reviews (progress bar must be 100%)

### ❌ analyze-07c3-results.ts finds no feedback

**Solution**: Make sure you clicked "Exportar Resultados" to save feedback to JSON

---

## Decision Tree

```
START
  ↓
STEP 1: Generate samples (validate-07c3.ts)
  ↓ FASE_07C3_VALIDATION_DATA.json created
  ↓
STEP 2: Open FASE_07C3_VALIDATOR.canvas.tsx
  ↓
STEP 3: Review samples
  ├─ CORRECT? → Mark CORRECT
  ├─ INCORRECT? → Mark INCORRECT + specify correct category
  └─ UNCERTAIN? → Mark UNCERTAIN
  ↓
STEP 4: Export results (Canvas button)
  ↓ FASE_07C3_HUMAN_FEEDBACK.json created
  ↓
STEP 5: Analyze results (analyze-07c3-results.ts)
  ↓ FASE_07C3_RESULTADOS_FINALES.json created
  ↓
DONE: Review recommendations in final report
  ↓
NEXT: Design FASE 07C4 based on metrics
```

---

## Quality Checks

Before moving to FASE 07C4:

- [ ] All samples reviewed (no missing decisions)
- [ ] INCORRECT cases have correct category specified
- [ ] Final report generated
- [ ] Acceptance rates calculated per source
- [ ] RULES: Analyzed by confidence bucket
- [ ] Recommendations documented

---

## Files Summary

| File | Created By | Used By | Contains |
|------|-----------|---------|----------|
| `scripts/validate-07c3.ts` | Setup | STEP 1 | Sample extractor |
| `FASE_07C3_VALIDATION_DATA.json` | STEP 1 | Canvas | Validation samples |
| `FASE_07C3_VALIDATOR.canvas.tsx` | Setup | STEP 2-4 | Interactive validator |
| `FASE_07C3_HUMAN_FEEDBACK.json` | Canvas | STEP 5 | Human decisions |
| `scripts/analyze-07c3-results.ts` | Setup | STEP 5 | Results analyzer |
| `FASE_07C3_RESULTADOS_FINALES.json` | STEP 5 | Design | Final metrics + recommendations |
| `FASE_07C3_VALIDACION_HUMANA.md` | Setup | Reference | Main documentation |

---

## Important Constraints

### ✅ Allowed

- Reading transactions
- Analyzing suggestions
- Recording feedback
- Calculating metrics
- Generating recommendations

### ❌ Prohibited

- Modifying Firebase
- Creating endpoints
- Building UI for approval (design only in FASE 07C4)
- Changing thresholds
- Auto-applying suggestions
- Persisting decisions to transactional data

---

## Next Phase

### After FASE 07C3 Completes

**FASE 07C4** (Design Only):

Based on acceptance rates:
- Design batch approval UI
- Decide thresholds by source
- Plan integration strategy
- Document new categories if needed

**NOT**: Implementation, Firebase changes, or endpoint creation

---

## Questions?

Refer to:
- `docs/FASE_07C3_VALIDACION_HUMANA.md` — Full specifications
- `FASE_07C3_RESULTADOS_FINALES.json` — Final results
- This guide — Execution steps

**Status**: FASE_07C3_EXECUTION_GUIDE_READY

