import { Agent } from '@cursor/sdk';

// Define the 10 candidates from the real extraction
const candidates = [
  {
    caseId: "A1",
    description: "ASISTENCIA 365",
    transactionId: "-P0hVFjFRnoPLR_DAQ9s"
  },
  {
    caseId: "A2",
    description: "MIX UP (1/3)",
    transactionId: "-P0hVvin_D0B5f9eiHA"
  },
  {
    caseId: "A3",
    description: "DREAMSTORE OCA (1/3)",
    transactionId: "-P0hVG7qyj_F9c_zaKLC"
  },
  {
    caseId: "A4",
    description: "RETIRO CORRESPONSALES , MONTEVIDEO TARJ: ############3759",
    transactionId: "-P0hXMG8t_G6zo8PZcE5"
  },
  {
    caseId: "A5",
    description: "COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO TARJ: ############3759",
    transactionId: "-P0hYCIwks7X0I7SLZR_"
  },
  {
    caseId: "A6",
    description: "COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO TARJ: ############3759",
    transactionId: "-P0hYgAuv5PLoQK_k2mQ"
  },
  {
    caseId: "A7",
    description: "COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO TARJ: ############3759",
    transactionId: "-P0hYgRKaqCQwt403dX9"
  },
  {
    caseId: "A8",
    description: "DEBITO OPERACION EN BANCA DIGITAL P--",
    transactionId: "-P0hYh93dF_tInrXis9X"
  },
  {
    caseId: "A9",
    description: "DEBITO OPERACION EN BANCA DIGITAL P--",
    transactionId: "-P0hYhCLeJAjZBHSOhRv"
  },
  {
    caseId: "A10",
    description: "DEBITO OPERACION EN BANCA DIGITAL PCREDITO",
    transactionId: "-P0hYz9-ku8V81YpHQ80"
  }
];

// Real categories from Firebase
const categories = [
  { id: "-OvakfDetF7DxZd0cxkr", name: "Alimentación" },
  { id: "-OvakfMgFGmLRLwQAv8b", name: "Salud y Bienestar" },
  { id: "-OvakfNqNHxQAx9aYyJc", name: "Educación" },
  { id: "-OvakfPtPQrRuYzQAx9d", name: "Entretenimiento" },
  { id: "-OvakfQvQSsStWaQAx9e", name: "Transporte" },
  { id: "-OvakfRxRTuTuXbQAx9f", name: "Servicios y Utilidades" },
  { id: "-OvakfSzSUvUuYcQAx9g", name: "Ropa y Accesorios" },
  { id: "-OvakfUuTVwVvZdQAx9h", name: "Vivienda" },
  { id: "-OvakfVwUWxWwaRQAx9i", name: "Diversión y Ocio" },
  { id: "-OvakfXyVXyXxbRQAx9j", name: "Ingresos" },
  { id: "-OvakfZaWYzYycRQAx9k", name: "Reingreso IVA" },
  { id: "-OvakfbbXZaZzdRQAx9l", name: "Sueldos" },
  { id: "-OvakfddYaabbRQAx9m", name: "Transferencias" },
  { id: "-OvakfffZbbbRQAx9n", name: "Otros" }
];

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('FASE 07C3B — LLM PILOT (ibm-ica)');
    console.log('='.repeat(80) + '\n');

    const systemPrompt = `You are a financial transaction categorization assistant. Analyze the transaction description and suggest the most appropriate category.

Available categories:
${categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

For each transaction, respond ONLY with a JSON object:
{
  "suggestedCategoryId": "<category ID>",
  "suggestedCategoryName": "<category name>",
  "agentConfidence": <0.0-1.0>,
  "reasoningSummary": "<2-3 line explanation>"
}`;

    const results = [];
    let processedCount = 0;
    let validCount = 0;
    let invalidCount = 0;

    for (const candidate of candidates) {
      console.log(`Processing ${candidate.caseId}: ${candidate.description}`);

      try {
        // Use Cursor Agent for LLM call
        const agent = await Agent.create({
          model: 'ibm-ica',
          systemPrompt,
          instructions: `Categorize this transaction: "${candidate.description}"`
        });

        const messages = await agent.send([
          {
            role: 'user',
            content: `Transaction description: ${candidate.description}`
          }
        ]);

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant') {
          try {
            const parsed = JSON.parse(lastMessage.content);
            
            // Validate category exists
            const categoryExists = categories.some(c => c.id === parsed.suggestedCategoryId);
            
            if (!categoryExists) {
              console.log(`  ❌ INVALID_CATEGORY: ${parsed.suggestedCategoryId}`);
              invalidCount++;
              results.push({
                caseId: candidate.caseId,
                description: candidate.description,
                transactionId: candidate.transactionId,
                suggestedCategoryId: null,
                suggestedCategoryName: null,
                agentConfidence: 0,
                reasoningSummary: `Category ${parsed.suggestedCategoryId} does not exist in catalog`,
                status: 'INVALID_CATEGORY',
                rawResponse: parsed
              });
            } else {
              console.log(`  ✅ ${parsed.suggestedCategoryName} (${parsed.agentConfidence})`);
              validCount++;
              results.push({
                caseId: candidate.caseId,
                description: candidate.description,
                transactionId: candidate.transactionId,
                suggestedCategoryId: parsed.suggestedCategoryId,
                suggestedCategoryName: parsed.suggestedCategoryName,
                agentConfidence: parsed.agentConfidence,
                reasoningSummary: parsed.reasoningSummary,
                status: 'VALID'
              });
            }
          } catch (e) {
            console.log(`  ❌ JSON parse error: ${lastMessage.content.substring(0, 100)}`);
            invalidCount++;
            results.push({
              caseId: candidate.caseId,
              description: candidate.description,
              transactionId: candidate.transactionId,
              status: 'PARSE_ERROR',
              rawResponse: lastMessage.content
            });
          }
        }
      } catch (error) {
        console.log(`  ❌ Agent error: ${error.message}`);
        invalidCount++;
        results.push({
          caseId: candidate.caseId,
          description: candidate.description,
          transactionId: candidate.transactionId,
          status: 'AGENT_ERROR',
          error: error.message
        });
      }

      processedCount++;
    }

    console.log('\n' + '='.repeat(80));
    console.log('LLM PILOT RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log(`Processed: ${processedCount}`);
    console.log(`Valid suggestions: ${validCount}`);
    console.log(`Invalid: ${invalidCount}\n`);

    // Output results
    const finalReport = {
      timestamp: new Date().toISOString(),
      phase: 'FASE_07C3B_LLM_PILOT',
      agentProcessed: processedCount,
      validSuggestions: validCount,
      invalidSuggestions: invalidCount,
      llmCalls: processedCount,
      suggestions: results
    };

    console.log(JSON.stringify(finalReport, null, 2));

    process.exit(0);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
