'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ViewType = 'gasto' | 'faturado';

interface TransactionViewTypeState {
  viewType: ViewType;
  setViewType: (type: ViewType) => void;
}

const VALID_VIEW_TYPES: ViewType[] = ['gasto', 'faturado'];
const DEFAULT_VIEW_TYPE: ViewType = 'gasto';

/**
 * Hook for managing transaction view type filter (Gasto vs Faturado) with URL search params.
 * Reads from `?viewType=gasto` or `?viewType=faturado` URL parameter.
 * Defaults to 'gasto' if param is missing or invalid.
 *
 * @returns {TransactionViewTypeState} Object containing:
 *   - viewType: Current view type ('gasto' or 'faturado')
 *   - setViewType: Function to update view type (updates URL and navigates)
 */
export function useTransactionViewType(): TransactionViewTypeState {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read viewType from URL params with memoization
  const viewType = useMemo(() => {
    const param = searchParams.get('viewType');

    // Validate the param and return default if invalid
    if (param && VALID_VIEW_TYPES.includes(param as ViewType)) {
      return param as ViewType;
    }

    return DEFAULT_VIEW_TYPE;
  }, [searchParams]);

  // Create setViewType function with useCallback to preserve reference
  const setViewType = useCallback(
    (type: ViewType) => {
      // Create new URLSearchParams from current params
      const params = new URLSearchParams(searchParams.toString());

      // Set the viewType param
      params.set('viewType', type);

      // Push to router with scroll: false to prevent layout shift
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    viewType,
    setViewType,
  };
}
