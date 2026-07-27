'use client';

import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Reusable button component that toggles between hamburger and X icons.
 * Shows Menu icon when sidebar is collapsed, X icon when expanded.
 * Positioned at the top of the sidebar to control its expand/collapse state.
 */
export function SidebarToggle({ isExpanded, onToggle }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={isExpanded ? 'Fechar barra lateral' : 'Abrir barra lateral'}
      aria-expanded={isExpanded}
    >
      {isExpanded ? (
        <X className="h-4 w-4" />
      ) : (
        <Menu className="h-4 w-4" />
      )}
    </Button>
  );
}
