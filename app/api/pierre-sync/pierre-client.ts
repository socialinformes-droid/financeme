/**
 * Cliente MCP para Pierre Finance
 * Usa JSON-RPC 2.0 com SSE para comunicação
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

interface ParsedTransaction {
  merchant: string;
  amount: number;
  date: string;
  description?: string;
  cardName?: string;
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
      const response = await this.makeRequest(payload);
      return response.result?.serverInfo?.name === 'Pierre Finance';
    } catch (error) {
      console.error('Failed to initialize Pierre client:', error);
      return false;
    }
  }

  /**
   * Busca extrato bancário dos últimos N dias
   */
  async getRecentTransactions(days: number = 30): Promise<ParsedTransaction[]> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const payload: MCPToolCall = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'getBankStatement',
        arguments: {
          startDate: this.formatDate(startDate),
          endDate: this.formatDate(now),
          statementScope: 'complete',
          groupBy: 'statement',
          topTransactionsLimit: 50,
        },
      },
    };

    try {
      const response = await this.makeRequest(payload);
      return this.parseTransactions(response);
    } catch (error) {
      console.error('Failed to get transactions from Pierre:', error);
      return [];
    }
  }

  /**
   * Busca fatura atual (saldo em aberto do cartão)
   */
  async getCurrentBill(): Promise<{
    total: number;
    dueDate: string;
    accounts: Array<{ name: string; amount: number }>;
  } | null> {
    const payload: MCPToolCall = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'getBill',
        arguments: {
          // Sem month = fatura atual em aberto
        },
      },
    };

    try {
      const response = await this.makeRequest(payload);
      return this.parseBill(response);
    } catch (error) {
      console.error('Failed to get bill from Pierre:', error);
      return null;
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
      await this.makeRequest(payload);
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
   * Parse transações do response da Pierre
   */
  private parseTransactions(response: unknown): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    try {
      const content = (response as any)?.result?.content?.[0]?.text;
      if (!content) return [];

      // Response vem em JSON, não em texto
      try {
        const data = JSON.parse(content);
        // Estrutura esperada: { success, data: { transactionList: [...] } }
        const list = data?.data?.transactionList || [];

        for (const tx of list) {
          if (!tx.amount || !tx.merchant) continue;

          transactions.push({
            merchant: tx.merchant || 'Unknown',
            amount: Math.abs(tx.amount), // Sempre positivo
            date: tx.transactionDate || new Date().toISOString().split('T')[0],
            description: tx.description,
            cardName: tx.cardName,
          });
        }
      } catch {
        // Se não conseguir fazer parse como JSON, content é string descritiva
        console.warn('Could not parse transaction list');
      }
    } catch (error) {
      console.error('Error parsing transactions:', error);
    }

    return transactions;
  }

  /**
   * Parse fatura do response
   */
  private parseBill(response: unknown): {
    total: number;
    dueDate: string;
    accounts: Array<{ name: string; amount: number }>;
  } | null {
    try {
      const content = (response as any)?.result?.content?.[0]?.text;
      if (!content) return null;

      // Tenta fazer parse como JSON
      try {
        const data = JSON.parse(content);
        const bills = data?.data?.officialBills || [];

        if (bills.length === 0) return null;

        const total = bills.reduce((sum: number, bill: any) => sum + (bill.official_bill_amount || 0), 0);
        const dueDate = bills[0]?.due_date || new Date().toISOString().split('T')[0];

        return {
          total,
          dueDate,
          accounts: bills.map((bill: any) => ({
            name: bill.account_name || 'Unknown',
            amount: bill.official_bill_amount || 0,
          })),
        };
      } catch {
        console.warn('Could not parse bill data');
        return null;
      }
    } catch (error) {
      console.error('Error parsing bill:', error);
      return null;
    }
  }

  /**
   * Formata data como YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
