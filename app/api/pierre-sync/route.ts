import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { mapMerchantToCategory } from './merchant-mapper';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      merchant,
      transaction_date,
      external_id,
      description,
      card_name,
    } = body;

    // Validar campos obrigatórios
    if (!amount || !merchant || !transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, merchant, transaction_date' },
        { status: 400 }
      );
    }

    // Mapear categoria automaticamente
    const category = mapMerchantToCategory(merchant);

    // Verificar se já existe transação com esse external_id (evitar duplicata)
    if (external_id) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('description', `[Pierre] ${merchant}`)
        .eq('transaction_date', transaction_date)
        .eq('amount', amount)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: true, skipped: true, message: 'Transaction already exists' },
          { status: 200 }
        );
      }
    }

    // Encontrar o cartão por nome (se fornecido)
    let card_id: string | null = null;
    if (card_name) {
      const { data: card } = await supabase
        .from('cards')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', card_name)
        .single();

      card_id = card?.id ?? null;
    }

    // Inserir transação
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: `[Pierre] ${merchant}`,
        amount,
        type: 'expense',
        payment_method: 'credit',
        category,
        transaction_date,
        card_id,
        is_paid: false,
        is_recurring: false,
        is_installment: false,
        notes: description ? `Auto-sync from Pierre: ${description}` : 'Auto-sync from Pierre API',
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        transaction: transaction?.[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parâmetro manual=true para sincronização manual
    const manual = request.nextUrl.searchParams.get('manual') === 'true';
    const days = parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10);

    if (!manual) {
      return NextResponse.json(
        { error: 'Use POST for webhook or ?manual=true for manual sync' },
        { status: 400 }
      );
    }

    // Sincronizar com Pierre
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

    // Buscar transações recentes
    const transactions = await client.getRecentTransactions(days);

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No new transactions found',
        lastSync: new Date().toISOString(),
      });
    }

    // Inserir transações no Supabase
    let synced = 0;
    const errors: Array<{ transaction: string; error: string }> = [];

    for (const tx of transactions) {
      try {
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            description: `[Pierre] ${tx.merchant}`,
            amount: tx.amount,
            type: 'expense',
            payment_method: 'credit',
            category: mapMerchantToCategory(tx.merchant),
            transaction_date: tx.date,
            is_paid: false,
            is_recurring: false,
            is_installment: false,
            notes: tx.description
              ? `Auto-sync from Pierre: ${tx.description}`
              : 'Auto-sync from Pierre API',
          });

        if (!error) {
          synced++;
        } else {
          errors.push({
            transaction: `${tx.merchant} - ${tx.amount}`,
            error: error.message,
          });
        }
      } catch (error) {
        errors.push({
          transaction: `${tx.merchant} - ${tx.amount}`,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      total: transactions.length,
      skipped: transactions.length - synced,
      errors: errors.length > 0 ? errors : undefined,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
