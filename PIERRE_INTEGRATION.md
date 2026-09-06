# Integração Pierre Finance no Financeme

Esta documentação descreve como usar a integração automática de transações do cartão de crédito via API da Pierre.

## Setup

### 1. Variáveis de Ambiente

Adicione ao `.env.local`:

```bash
PIERRE_API_KEY=sk-sua-chave-aqui
```

### 2. Adicionar Botão ao Dashboard

No seu dashboard (ex: `app/(app)/dashboard/page.tsx`), importe e adicione o componente:

```tsx
import { PierreSyncButton } from '@/components/pierre-sync-button';

export default function Dashboard() {
  return (
    <div>
      {/* ... outros componentes ... */}
      <div className="flex justify-end mb-4">
        <PierreSyncButton />
      </div>
      {/* ... */}
    </div>
  );
}
```

## Como Funciona

### Sincronização Manual

1. Clique em "Sincronizar Pierre" no dashboard
2. O sistema busca as transações dos últimos 7 dias
3. Cada transação é mapeada automaticamente para uma categoria
4. As transações são inseridas no Supabase

### Sincronização por Webhook (futuro)

Você também pode receber webhooks da Pierre enviando POST para:

```
POST https://seu-financeme.vercel.app/api/pierre-sync
```

Body esperado:

```json
{
  "merchant": "Uber Brasil",
  "amount": 45.50,
  "transaction_date": "2026-09-06",
  "description": "Viagem para Paulista",
  "card_name": "Nubank",
  "external_id": "pierre_tx_123456"
}
```

## Mapeamento de Categorias

As categorias são mapeadas automaticamente baseado no nome do comerciante:

| Palavra-chave | Categoria |
|---|---|
| uber, taxi | Transporte |
| restaurante, pizza, churrasco | Alimentação |
| farmácia, drogaria | Saúde |
| netflix, spotify | Lazer |
| mercado, supermercado | Alimentação |
| sabesp, energia, internet | Moradia |
| academia, fitness | Saúde |
| (nenhuma match) | Outros |

### Adicionar Novo Mapeamento

Edit `app/api/pierre-sync/merchant-mapper.ts` e adicione um novo padrão:

```typescript
{
  keywords: ['sua-palavra', 'outra-palavra'],
  category: 'SuaCategoria'
}
```

## API Endpoints

### GET /api/pierre-sync?manual=true

Sincroniza manualmente as últimas transações.

**Query Parameters:**
- `manual=true` (obrigatório)
- `days=7` (opcional, padrão 7 dias)

**Response:**

```json
{
  "success": true,
  "synced": 5,
  "total": 8,
  "skipped": 3,
  "lastSync": "2026-09-06T14:30:00.000Z",
  "errors": [
    {
      "transaction": "Comerciante - 45.50",
      "error": "Duplicate transaction"
    }
  ]
}
```

### POST /api/pierre-sync

Recebe um webhook com uma transação individual.

**Body:**

```json
{
  "merchant": "Uber Brasil",
  "amount": 45.50,
  "transaction_date": "2026-09-06",
  "description": "Viagem",
  "card_name": "Nubank",
  "external_id": "pierre_123"
}
```

**Response:**

```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "description": "[Pierre] Uber Brasil",
    "amount": 45.50,
    "category": "Transporte",
    ...
  }
}
```

## Troubleshooting

### "PIERRE_API_KEY not configured"

- Verifique se adicionou a variável ao `.env.local`
- Na Vercel, adicione em Project Settings → Environment Variables
- Redeploy após adicionar

### "Failed to connect to Pierre API"

- Verifique se a API key está correta
- Verifique sua conexão de internet
- Tente fazer manual update na dashboard da Pierre

### "Transaction already exists"

- O sistema detecta duplicatas comparando merchant, data e valor
- Se precisar reinserir, delete a transação anterior

### Transações não aparecem

1. Verifique se a categorização funcionou:
   - Abra DevTools → Network
   - Procure por `/api/pierre-sync?manual=true`
   - Veja a response (synced, total, errors)

2. Verifique no Supabase:
   - Vá para a tabela `transactions`
   - Procure por `description LIKE '%[Pierre]%'`

## Estrutura do Código

```
app/api/pierre-sync/
├── route.ts              # Endpoints GET/POST
├── merchant-mapper.ts    # Lógica de categorização
├── pierre-client.ts      # Cliente MCP da Pierre
└── __tests__/
    └── merchant-mapper.test.ts
```

## Próximos Passos

- [ ] Configurar webhook automático na Pierre
- [ ] Adicionar UI para mapear categorias manualmente
- [ ] Implementar histórico de sync
- [ ] Adicionar alertas para transações grandes
- [ ] Machine learning para melhorar categorização

## Dúvidas ou Problemas?

Verifique os logs da Vercel:

```bash
vercel logs --follow
```

Ou examine os erros no console do seu navegador (F12).
