import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ⚠️ IMPORTANTE: Esta integração sincroniza APENAS faturas de cartão
 * NÃO sincroniza transações individuais para evitar:
 * - Duplicação com transações recorrentes mapeadas manualmente
 * - Confusão entre fatura (promissória) e transações reais
 *
 * Fluxo:
 * 1. Busca faturas em aberto de cada cartão (Pierre)
 * 2. Atualiza bill_amount + bill_due_date na tabela cards
 * 3. Dashboard mostra 3 gráficos: Cartão | Débito/PIX | Total
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sincronizar faturas
    const { PierreClient } = await import('./pierre-client');
    const apiKey = process.env.PIERRE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'PIERRE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new PierreClient(apiKey);
    const initialized = await client.initialize();

    if (!initialized) {
      return NextResponse.json(
        { error: 'Failed to connect to Pierre API' },
        { status: 503 }
      );
    }

    // Force update dos dados
    await client.manualUpdate();

    // Buscar faturas de todos os cartões
    const bills = await client.getAllBills();

    if (bills.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        total: 0,
        skipped: 0,
        lastSync: new Date().toISOString(),
      });
    }

    // Atualizar faturas na tabela cards
    let updated = 0;
    const errors: Array<{ card: string; error: string }> = [];

    for (const bill of bills) {
      try {
        // Encontrar cartão pelo nome da conta (Nubank, Inter, etc)
        // Não usa .single() porque lança erro tanto pra 0 quanto pra 2+ matches —
        // aqui queremos distinguir os dois casos na mensagem de erro.
        const { data: matches, error: lookupError } = await supabase
          .from('cards')
          .select('id, name')
          .eq('user_id', user.id)
          .ilike('name', `%${bill.accountName}%`);

        if (lookupError) {
          errors.push({ card: bill.accountName, error: lookupError.message });
          continue;
        }

        if (!matches || matches.length === 0) {
          errors.push({
            card: bill.accountName,
            error: `Nenhum cartão cadastrado com nome contendo "${bill.accountName}". Cadastre um cartão com esse nome (ou parte dele) na aba Cartões.`,
          });
          continue;
        }

        if (matches.length > 1) {
          errors.push({
            card: bill.accountName,
            error: `${matches.length} cartões cadastrados batem com "${bill.accountName}" (${matches.map((m) => m.name).join(', ')}) — ambíguo, pulei.`,
          });
          continue;
        }

        const card = matches[0];

        // Atualizar fatura do cartão
        const { error } = await supabase
          .from('cards')
          .update({
            bill_amount: bill.amount,
            bill_due_date: bill.dueDate,
            bill_updated_at: new Date().toISOString(),
          })
          .eq('id', card.id);

        if (!error) {
          updated++;
        } else {
          errors.push({
            card: bill.accountName,
            error: error.message,
          });
        }
      } catch (error) {
        errors.push({
          card: bill.accountName,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: bills.length,
      skipped: bills.length - updated,
      errors: errors.length > 0 ? errors : undefined,
      lastSync: new Date().toISOString(),
      note: '✅ Sincronizando APENAS faturas (não transações) para evitar duplicação',
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
