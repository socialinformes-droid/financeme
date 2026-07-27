'use client';

import { Button } from '@/components/ui/button';

export interface ViewTypeFilterProps {
  viewType: 'gasto' | 'faturado';
  onViewTypeChange: (type: 'gasto' | 'faturado') => void;
}

export function ViewTypeFilter({ viewType, onViewTypeChange }: ViewTypeFilterProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={viewType === 'gasto' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewTypeChange('gasto')}
        className="transition-colors"
      >
        Gasto
      </Button>
      <Button
        variant={viewType === 'faturado' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewTypeChange('faturado')}
        className="transition-colors"
      >
        Faturado
      </Button>
    </div>
  );
}
