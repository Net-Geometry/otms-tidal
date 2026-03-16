// src/lib/bankStatementMatcher.ts
import type { ExtractedTransaction } from './bankStatementExtractor';
import type { BankReconciliationItem } from '@/types/finance';

export interface MatchResult {
  /** Reconciliation item ID → extracted transaction index */
  matches: Map<string, number>;
  /** Indices of extracted transactions with no GL match */
  unmatchedExtracted: number[];
  /** IDs of recon items with no statement match */
  unmatchedItems: string[];
}

function parseDate(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function datesClose(a: string, b: string): boolean {
  const diff = Math.abs(parseDate(a) - parseDate(b));
  return diff <= 86400000; // 1 day in ms
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function matchTransactions(
  extractedTxns: ExtractedTransaction[],
  reconItems: BankReconciliationItem[],
): MatchResult {
  const matches = new Map<string, number>();
  const matchedExtractedIndices = new Set<number>();
  const matchedItemIds = new Set<string>();

  // Only try to match unreconciled items
  const unreconciledItems = reconItems.filter((item) => !item.is_reconciled);

  // Pass 1: exact amount + close date
  for (const item of unreconciledItems) {
    if (matchedItemIds.has(item.id)) continue;

    const itemDebit = item.debit_amount || 0;
    const itemCredit = item.credit_amount || 0;

    for (let i = 0; i < extractedTxns.length; i++) {
      if (matchedExtractedIndices.has(i)) continue;
      const txn = extractedTxns[i];

      const amountOk =
        (itemDebit > 0 && amountsMatch(itemDebit, txn.debit)) ||
        (itemCredit > 0 && amountsMatch(itemCredit, txn.credit));

      if (!amountOk) continue;

      const dateOk = !item.entry_date || !txn.date || datesClose(item.entry_date, txn.date);

      if (dateOk) {
        matches.set(item.id, i);
        matchedExtractedIndices.add(i);
        matchedItemIds.add(item.id);
        break;
      }
    }
  }

  // Pass 2: amount-only match for remaining (no date requirement)
  for (const item of unreconciledItems) {
    if (matchedItemIds.has(item.id)) continue;

    const itemDebit = item.debit_amount || 0;
    const itemCredit = item.credit_amount || 0;

    for (let i = 0; i < extractedTxns.length; i++) {
      if (matchedExtractedIndices.has(i)) continue;
      const txn = extractedTxns[i];

      const amountOk =
        (itemDebit > 0 && amountsMatch(itemDebit, txn.debit)) ||
        (itemCredit > 0 && amountsMatch(itemCredit, txn.credit));

      if (amountOk) {
        matches.set(item.id, i);
        matchedExtractedIndices.add(i);
        matchedItemIds.add(item.id);
        break;
      }
    }
  }

  const unmatchedExtracted = extractedTxns
    .map((_, i) => i)
    .filter((i) => !matchedExtractedIndices.has(i));

  const unmatchedItems = unreconciledItems
    .map((item) => item.id)
    .filter((id) => !matchedItemIds.has(id));

  return { matches, unmatchedExtracted, unmatchedItems };
}
