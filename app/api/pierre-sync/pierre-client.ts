/**
 * Cliente MCP para Pierre Finance
 * Sincroniza APENAS faturas do cartão (não transações individuais)
 */

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface MCPToolCall {
  jsonrpc: '2.0';
  id: number;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface CardBill {
  accountName: string;
  accountId: string;
  amount: number;
  dueDate: string;
  closingDate?: string;
}

export class PierreClient {
  private apiKey: string;
  private apiUrl = 'https://pierre.finance/mcp';
  private requestId = 1;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('PIERRE_API_KEY is not set');
    }
    this.apiKey = apiKey;
  }

  /**
   * Inicializa conexão com servidor MCP
   */
  async initialize(): Promise<boolean> {
    const payload: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
        },
        clientInfo: {
          name: 'FinanceMe Pierre Sync',
          version: '1.0.0',
        },
      },
    };

    try {
      const response = await this.makeRequest(payload) as any;
      return response.result?.serverInfo?.name === 'Pierre Finance';
    } catch (error) {
      console.error('Failed to initialize Pierre client:', error);
      return false;
    }
  }

  /**
   * Busca faturas em aberto de todos os cartões
   * ⚠️ NÃO sincroniza transações individuais para evitar duplicação
   */
  async getAllBills(): Promise<CardBill[]> {
    const payload: MCPToolCall = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'getBill',
        arguments: {
          // Sem month = busca fatura em aberto atual
        },
      },
    };

    try {
      const response = await this.makeRequest(payload) as any;
      return this.parseBills(response);
    } catch (error) {
      console.error('Failed to get bills from Pierre:', error);
      return [];
    }
  }


  /**
   * Sincroniza contas (força atualização dos dados)
   */
  async manualUpdate(): Promise<boolean> {
    const payload: MCPToolCall = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'manualUpdate',
        arguments: {},
      },
    };

    try {
      await (this.makeRequest(payload) as Promise<any>);
      return true;
    } catch (error) {
      console.error('Failed to update Pierre data:', error);
      return false;
    }
  }

  /**
   * Faz requisição HTTP para o servidor MCP
   */
  private async makeRequest(payload: MCPRequest | MCPToolCall): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Pierre API error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\n');
      const dataLine = lines.find((l) => l.startsWith('data:'))?.replace('data: ', '');

      if (!dataLine) {
        throw new Error('No data in Pierre response');
      }

      const parsed = JSON.parse(dataLine);

      if (parsed.error) {
        throw new Error(`Pierre error: ${parsed.error.message}`);
      }

      return parsed;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Pierre API request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse faturas do response da Pierre
   * Retorna uma fatura por cartão/conta
   */
  private parseBills(response: unknown): CardBill[] {
    const bills: CardBill[] = [];

    try {
      const content = (response as any)?.result?.content?.[0]?.text;
      if (!content) return [];

      try {
        const data = JSON.parse(content);
        const officialBills = data?.data?.officialBills || [];

        for (const bill of officialBills) {
          if (!bill.account_name || bill.official_bill_amount === undefined) continue;

          bills.push({
            accountName: bill.account_name,
            accountId: bill.account_id,
            amount: Math.max(0, bill.official_bill_amount), // Nunca negativo
            dueDate: bill.due_date || new Date().toISOString().split('T')[0],
            closingDate: bill.closing_day,
          });
        }
      } catch {
        console.warn('Could not parse bills data');
      }
    } catch (error) {
      console.error('Error parsing bills:', error);
    }

    return bills;
  }

  /**
   * Formata data como YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
