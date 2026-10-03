#!/usr/bin/env node

/**
 * Unit Test - Financial Summary Logic ONLY
 * 
 * No imports of compiled code, pure logic testing.
 */

console.log('📊 FINANCIAL SUMMARY TOOL - LOGIC TESTS\n');

// Test 1: Validation Logic
console.log('═══════════════════════════════════════');
console.log('TEST 1: Input Validation Rules');
console.log('═══════════════════════════════════════\n');

function validateInput(input) {
  if (typeof input !== 'object' || input === null) {
    throw new Error('INVALID_ARGUMENT: Input must be an object');
  }

  const obj = input;

  // Reject prohibited parameters
  const prohibitedParams = ['uid', 'userId', 'familyId', 'firebasePath', 'path'];
  for (const param of prohibitedParams) {
    if (param in obj) {
      throw new Error(`SECURITY_VIOLATION: Parameter '${param}' is not allowed`);
    }
  }

  // Validate known parameters
  const allowed = new Set(['from', 'to', 'currency', 'accountId', 'categoryId']);
  for (const key in obj) {
    if (!allowed.has(key)) {
      throw new Error(`INVALID_ARGUMENT: Unknown parameter '${key}'`);
    }
  }

  // Validate required: from
  if (!('from' in obj)) {
    throw new Error('INVALID_ARGUMENT: from is required');
  }

  const from = obj.from;
  if (typeof from !== 'number' || !Number.isFinite(from) || from < 0) {
    throw new Error('INVALID_ARGUMENT: from must be a valid positive number');
  }

  // Validate required: to
  if (!('to' in obj)) {
    throw new Error('INVALID_ARGUMENT: to is required');
  }

  const to = obj.to;
  if (typeof to !== 'number' || !Number.isFinite(to) || to < 0) {
    throw new Error('INVALID_ARGUMENT: to must be a valid positive number');
  }

  // Validate that from <= to
  if (from > to) {
    throw new Error('INVALID_ARGUMENT: from must be <= to');
  }

  return true;
}

const validTests = [
  { name: 'Valid: basic', input: { from: 0, to: 1000 } },
  { name: 'Valid: with currency', input: { from: 0, to: 1000, currency: 'UYU' } },
  { name: 'Valid: with USD', input: { from: 0, to: 1000, currency: 'USD' } },
];

let pass = 0;

for (const test of validTests) {
  try {
    validateInput(test.input);
    console.log(`✅ ${test.name}`);
    pass++;
  } catch (err) {
    console.log(`❌ ${test.name}: ${err.message}`);
  }
}

console.log();

const invalidTests = [
  { name: 'Invalid: missing from', input: { to: 1000 } },
  { name: 'Invalid: missing to', input: { from: 0 } },
  { name: 'Invalid: from > to', input: { from: 1000, to: 0 } },
  { name: 'Invalid: uid parameter', input: { from: 0, to: 1000, uid: 'hacker' } },
  { name: 'Invalid: userId', input: { from: 0, to: 1000, userId: 'hacker' } },
  { name: 'Invalid: familyId', input: { from: 0, to: 1000, familyId: 'hacker' } },
  { name: 'Invalid: firebasePath', input: { from: 0, to: 1000, firebasePath: '/other' } },
  { name: 'Invalid: path', input: { from: 0, to: 1000, path: '/other' } },
  { name: 'Invalid: unknown param', input: { from: 0, to: 1000, foo: 'bar' } },
  { name: 'Invalid: bad currency', input: { from: 0, to: 1000, currency: 'EUR' } },
];

for (const test of invalidTests) {
  try {
    validateInput(test.input);
    console.log(`❌ ${test.name}: should have thrown error`);
  } catch (err) {
    console.log(`✅ ${test.name}`);
    pass++;
  }
}

// Test 2: Calculate Summary Logic
console.log('\n═══════════════════════════════════════');
console.log('TEST 2: Calculate Summary Logic');
console.log('═══════════════════════════════════════\n');

function calculateSummary(transactions) {
  const summary = {
    income: 0,
    expenses: 0,
    net: 0,
    transfers: 0,
    transactionCount: 0,
    incomeCount: 0,
    expenseCount: 0,
    transferCount: 0,
  };

  for (const tx of transactions) {
    if (tx.type === 'income') {
      summary.income += tx.amount;
      summary.incomeCount += 1;
    } else if (tx.type === 'expense') {
      summary.expenses += Math.abs(tx.amount);
      summary.expenseCount += 1;
    } else if (tx.type === 'transfer') {
      summary.transfers += Math.abs(tx.amount);
      summary.transferCount += 1;
    }
    summary.transactionCount += 1;
  }

  summary.net = summary.income - summary.expenses;
  if (summary.income > 0) {
    summary.savingsRate = ((summary.income - summary.expenses) / summary.income) * 100;
  }

  return summary;
}

// Test dataset matching oracle
const testTx = [
  { type: 'income', amount: 8000 },
  { type: 'income', amount: 7000 },
  { type: 'expense', amount: -5000 },
  { type: 'expense', amount: -3100 },
  { type: 'expense', amount: -15000 },
  { type: 'transfer', amount: 2000 },
];

const result = calculateSummary(testTx);

console.log('Oracle Dataset:');
console.log('  Income:   15,000 (2 tx)');
console.log('  Expenses: 23,100 (3 tx)');
console.log('  Net:      -8,100');
console.log('  Transfers: 2,000 (1 tx)');

console.log('\nCalculated:');
console.log(`  Income:   ${result.income} (${result.incomeCount} tx)`);
console.log(`  Expenses: ${result.expenses} (${result.expenseCount} tx)`);
console.log(`  Net:      ${result.net}`);
console.log(`  Transfers: ${result.transfers} (${result.transferCount} tx)`);

const t1 = result.income === 15000;
const t2 = result.expenses === 23100;
const t3 = result.net === -8100;
const t4 = result.transfers === 2000;

console.log(`\n${t1 ? '✅' : '❌'} Income == 15,000`);
console.log(`${t2 ? '✅' : '❌'} Expenses == 23,100`);
console.log(`${t3 ? '✅' : '❌'} Net == -8,100`);
console.log(`${t4 ? '✅' : '❌'} Transfers == 2,000 (not in net)`);

if (t1 && t2 && t3 && t4) pass += 4;

// Test 3: Multi-currency
console.log('\n═══════════════════════════════════════');
console.log('TEST 3: Multi-Currency Separation');
console.log('═══════════════════════════════════════\n');

function calculateByMultipleCurrencies(transactions) {
  const summaries = new Map();

  for (const tx of transactions) {
    const curr = tx.currency;
    if (!summaries.has(curr)) {
      summaries.set(curr, {
        currency: curr,
        income: 0,
        expenses: 0,
        net: 0,
        transfers: 0,
        transactionCount: 0,
        incomeCount: 0,
        expenseCount: 0,
        transferCount: 0,
      });
    }

    const summary = summaries.get(curr);

    if (tx.type === 'income') {
      summary.income += tx.amount;
      summary.incomeCount += 1;
    } else if (tx.type === 'expense') {
      summary.expenses += Math.abs(tx.amount);
      summary.expenseCount += 1;
    } else if (tx.type === 'transfer') {
      summary.transfers += Math.abs(tx.amount);
      summary.transferCount += 1;
    }
    summary.transactionCount += 1;
  }

  for (const summary of summaries.values()) {
    summary.net = summary.income - summary.expenses;
    if (summary.income > 0) {
      summary.savingsRate = ((summary.income - summary.expenses) / summary.income) * 100;
    }
  }

  return summaries;
}

const multiCx = [
  { type: 'income', currency: 'UYU', amount: 10000 },
  { type: 'expense', currency: 'UYU', amount: -5000 },
  { type: 'income', currency: 'USD', amount: 200 },
  { type: 'expense', currency: 'USD', amount: -50 },
];

const resultMulti = calculateByMultipleCurrencies(multiCx);

console.log('Multi-currency result:');
for (const [curr, summary] of resultMulti) {
  console.log(`\n${curr}:`);
  console.log(`  Income:   ${summary.income}`);
  console.log(`  Expenses: ${summary.expenses}`);
  console.log(`  Net:      ${summary.net}`);
}

const uyu = resultMulti.get('UYU');
const usd = resultMulti.get('USD');

const t5 = uyu.net === 5000;
const t6 = usd.net === 150;
const t7 = resultMulti.size === 2;

console.log(`\n${t5 ? '✅' : '❌'} UYU Net == 5,000`);
console.log(`${t6 ? '✅' : '❌'} USD Net == 150`);
console.log(`${t7 ? '✅' : '❌'} 2 currencies detected (NOT MERGED)`);

if (t5 && t6 && t7) pass += 3;

// Test 4: Savings Rate
console.log('\n═══════════════════════════════════════');
console.log('TEST 4: Savings Rate');
console.log('═══════════════════════════════════════\n');

const savingsTx = [
  { type: 'income', amount: 1000 },
  { type: 'expense', amount: -600 },
];

const resultSavings = calculateSummary(savingsTx);

// savingsRate = ((1000 - 600) / 1000) * 100 = 40%
const expectedRate = 40;
console.log(`Expected: ((1000 - 600) / 1000) * 100 = ${expectedRate}%`);
console.log(`Calculated: ${resultSavings.savingsRate}%`);

const t8 = Math.abs(resultSavings.savingsRate - expectedRate) < 0.01;
console.log(`${t8 ? '✅' : '❌'} Savings rate == ${expectedRate}%`);

if (t8) pass++;

// Test 5: Zero income (no savings rate)
console.log('\n═══════════════════════════════════════');
console.log('TEST 5: Zero Income (No Savings Rate)');
console.log('═══════════════════════════════════════\n');

const noIncomeTx = [
  { type: 'expense', amount: -100 },
];

const resultNoIncome = calculateSummary(noIncomeTx);

console.log(`Income: ${resultNoIncome.income}`);
console.log(`Expenses: ${resultNoIncome.expenses}`);
console.log(`Savings Rate: ${resultNoIncome.savingsRate}`);

const t9 = resultNoIncome.income === 0;
const t10 = resultNoIncome.savingsRate === undefined;

console.log(`${t9 ? '✅' : '❌'} Income == 0`);
console.log(`${t10 ? '✅' : '❌'} Savings rate undefined (income == 0)`);

if (t9 && t10) pass += 2;

// Test 6: Negative net (more expenses)
console.log('\n═══════════════════════════════════════');
console.log('TEST 6: Negative Net (More Expenses)');
console.log('═══════════════════════════════════════\n');

const negativeTx = [
  { type: 'income', amount: 5000 },
  { type: 'expense', amount: -10000 },
];

const resultNegative = calculateSummary(negativeTx);

console.log(`Income: ${resultNegative.income}`);
console.log(`Expenses: ${resultNegative.expenses}`);
console.log(`Net: ${resultNegative.net}`);
console.log(`Savings Rate: ${resultNegative.savingsRate}%`);

const t11 = resultNegative.net === -5000;
const t12 = resultNegative.savingsRate === -100; // (5000 - 10000) / 5000 * 100 = -100

console.log(`${t11 ? '✅' : '❌'} Net == -5,000`);
console.log(`${t12 ? '✅' : '❌'} Savings rate == -100% (negative)`);

if (t11 && t12) pass += 2;

console.log('\n═══════════════════════════════════════');
console.log(`FINAL SCORE: ${pass} tests passed`);
console.log('═══════════════════════════════════════');
