'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export function PierreSyncButton() {
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/pierre-sync?manual=true&days=7', {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao sincronizar com Pierre');
        return;
      }

      if (data.synced > 0) {
        toast.success(
          `✅ ${data.synced} transação(ões) sincronizada(s) de ${data.total} encontrada(s)`
        );
      } else if (data.total === 0) {
        toast.info('ℹ️ Nenhuma transação nova encontrada nos últimos 7 dias');
      } else {
        toast.info(`ℹ️ ${data.total} transação(ões) já existem`);
      }

      setLastSync(new Date().toLocaleString('pt-BR'));

      if (data.errors && data.errors.length > 0) {
        console.warn('Errors during sync:', data.errors);
        toast.warning(`⚠️ ${data.errors.length} erro(s) encontrado(s)`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro de conexão ao sincronizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
        {loading ? 'Sincronizando...' : 'Sincronizar Pierre'}
      </Button>
      {lastSync && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 size={14} className="text-green-600" />
          Última sync: {lastSync}
        </span>
      )}
    </div>
  );
}
