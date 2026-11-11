'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ActiveScope } from '@/lib/domain/planned';
import type { TransactionRow } from '@/lib/supabase/types';

export function ActiveScopeDialog({
  target,
  nextActive,
  onClose,
  onConfirm,
}: {
  target: TransactionRow | null;
  nextActive: boolean;
  onClose: () => void;
  onConfirm: (scope: ActiveScope) => void;
}) {
  const verb = nextActive ? 'Ativar' : 'Marcar como previsto';
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{verb}</DialogTitle>
          <DialogDescription>
            {target?.description} faz parte de um grupo. Quais lançamentos devem mudar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="outline" onClick={() => onConfirm('one')}>
            Só este
          </Button>
          <Button variant="outline" onClick={() => onConfirm('forward')}>
            Este e os próximos
          </Button>
          <Button onClick={() => onConfirm('group')}>O grupo todo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
