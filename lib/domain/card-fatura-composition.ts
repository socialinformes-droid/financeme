import type { TransactionRow } from '@/lib/supabase/types';

export type FaturaLine = {
  tx: TransactionRow;
  /** ex.: "3/10" — presente só em parcelados com número/total */
  installmentLabel?: string;
};

export type FaturaComposition = {
  fixed: FaturaLine[];
  installments: FaturaLine[];
  oneOff: FaturaLine[];
  /** soma das linhas "base" não-itemizadas (category=Cartão, amount != 0) */
  baseAmount: number;
  fixedTotal: number;
  installmentsTotal: number;
  /** inclui baseAmount */
  oneOffTotal: number;
  total: number;
};

/** Linha "base" da fatura: o resto não-detalhado do extrato. */
export function isLumpFatura(t: TransactionRow): boolean {
  return t.category === 'Cartão' && !t.description.includes('(');
}

const abs = (v: TransactionRow['amount']) => Math.abs(Number(v));

/**
 * Compõe a fatura de um cartão num mês a partir da lista completa de transações.
 * Classificação exclusiva por linha: recorrente > parcelado > avulso.
 * Linhas base (lump) com amount != 0 entram só no total de avulsos (baseAmount),
 * sem virar item de lista. Placeholders (lump com amount 0) são ignorados.
 */
export function composeFatura(
  transactions: TransactionRow[],
  cardId: string,
  billingMonth: string,
): FaturaComposition {
  const fixed: FaturaLine[] = [];
  const installments: FaturaLine[] = [];
  const oneOff: FaturaLine[] = [];
  let baseAmount = 0;

  for (const t of transactions) {
    if (t.card_id !== cardId || t.billing_month !== billingMonth) continue;
    if (t.type !== 'expense') continue;

    if (isLumpFatura(t)) {
      baseAmount += abs(t.amount);
      continue;
    }

    if (t.is_recurring) {
      fixed.push({ tx: t });
    } else if (t.is_installment) {
      const label =
        t.installment_number && t.total_installments
          ? `${t.installment_number}/${t.total_installments}`
          : undefined;
      installments.push({ tx: t, installmentLabel: label });
    } else {
      oneOff.push({ tx: t });
    }
  }

  const sum = (lines: FaturaLine[]) => lines.reduce((a, l) => a + abs(l.tx.amount), 0);
  const fixedTotal = sum(fixed);
  const installmentsTotal = sum(installments);
  const oneOffTotal = sum(oneOff) + baseAmount;

  return {
    fixed,
    installments,
    oneOff,
    baseAmount,
    fixedTotal,
    installmentsTotal,
    oneOffTotal,
    total: fixedTotal + installmentsTotal + oneOffTotal,
  };
}
