'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sidebarExpanded';
const DEFAULT_EXPANDED = true;

interface SidebarState {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isHydrated: boolean;
}

/**
 * Hook for managing sidebar expanded/collapsed state with localStorage persistence.
 * Handles hydration properly for Next.js to prevent hydration mismatches.
 *
 * @returns {SidebarState} Object containing:
 *   - isExpanded: Current sidebar state (true = expanded, false = collapsed/icon-only)
 *   - toggleSidebar: Function to toggle the sidebar state
 *   - isHydrated: Flag indicating if the component has hydrated on the client
 */
export function useSidebarState(): SidebarState {
  const [isExpanded, setIsExpanded] = useState<boolean>(DEFAULT_EXPANDED);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Initialize state from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsExpanded(stored === 'true');
      }
    } catch (error) {
      // localStorage might not be available in all environments
      console.warn('Failed to read from localStorage:', error);
    }
    setIsHydrated(true);
  }, []);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(STORAGE_KEY, String(isExpanded));
    } catch (error) {
      // localStorage might not be available in all environments
      console.warn('Failed to write to localStorage:', error);
    }
  }, [isExpanded, isHydrated]);

  const toggleSidebar = () => {
    setIsExpanded((prev) => !prev);
  };

  return {
    isExpanded,
    toggleSidebar,
    isHydrated,
  };
}
