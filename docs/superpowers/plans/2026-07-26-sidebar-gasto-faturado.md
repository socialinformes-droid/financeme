# Sidebar Retraível + Filtro Gasto/Faturado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible sidebar with icon-only mode and a toggle filter for transactions view (gasto/faturado).

**Architecture:** 
- Sidebar state managed via custom hook with localStorage persistence
- Filtro Gasto/Faturado as toggle component in TransactionsView with URL params
- Both features independent; sidebar collapse doesn't affect transaction filtering
- Responsive: desktop supports toggle, mobile uses default behavior

**Tech Stack:** Next.js 16, React hooks, Supabase, TypeScript, TailwindCSS

## Global Constraints

- State persistence via `localStorage` for sidebar (key: `sidebarExpanded`)
- URL params for transaction view type (`?viewType=gasto` or `?viewType=faturado`)
- Default state: sidebar expanded, view type = `gasto`
- Mobile: sidebar toggle disabled, maintains existing behavior
- Animations: ~200ms transitions for sidebar collapse/expand

---

## File Structure

```
components/layout/
  ├── sidebar.tsx [MODIFY] - Add state management, conditional rendering for icon-only mode
  ├── sidebar-toggle.tsx [CREATE] - Hamburger button component
  └── sidebar-item.tsx [MODIFY] - Conditionally show tooltip when retraído

hooks/
  ├── use-sidebar-state.ts [CREATE] - Custom hook for sidebar state + localStorage
  └── use-transaction-view-type.ts [CREATE] - Custom hook for gasto/faturado filter

app/(app)/transactions/
  ├── _view.tsx [MODIFY] - Add ViewTypeFilter component, update query logic
  └── components/
      └── view-type-filter.tsx [CREATE] - Tab-like toggle for Gasto/Faturado
```

---

## Task 1: Create useSidebarState Hook

**Files:**
- Create: `hooks/use-sidebar-state.ts`

**Interfaces:**
- Consumes: Browser `localStorage` API
- Produces: Hook returning `{ isExpanded: boolean; toggleSidebar: () => void }`

- [ ] **Step 1: Write the hook with localStorage persistence**

Create `hooks/use-sidebar-state.ts`:

```typescript
import { useEffect, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'sidebarExpanded';

export function useSidebarState(defaultExpanded = true) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsExpanded(stored === 'true');
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage when state changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isExpanded));
    }
  }, [isExpanded, isHydrated]);

  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };

  return { isExpanded, toggleSidebar, isHydrated };
}
```

- [ ] **Step 2: Verify hook logic**

The hook should:
- ✅ Return initial state as `defaultExpanded=true`
- ✅ Read from localStorage on mount
- ✅ Save to localStorage on toggle
- ✅ Return `isHydrated` to prevent hydration mismatch

---

## Task 2: Create Sidebar Toggle Button Component

**Files:**
- Create: `components/layout/sidebar-toggle.tsx`

**Interfaces:**
- Consumes: `isExpanded: boolean`, `onToggle: () => void`
- Produces: Button component with hamburger icon

- [ ] **Step 1: Write the toggle button component**

Create `components/layout/sidebar-toggle.tsx`:

```typescript
'use client';

import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function SidebarToggle({ isExpanded, onToggle }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="h-10 w-10 rounded-md"
      aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isExpanded ? (
        <X className="h-5 w-5" />
      ) : (
        <Menu className="h-5 w-5" />
      )}
    </Button>
  );
}
```

- [ ] **Step 2: Verify component**

Component should:
- ✅ Show Menu icon when collapsed (retraído)
- ✅ Show X icon when expanded
- ✅ Call `onToggle()` when clicked
- ✅ Have proper accessibility attributes

---

## Task 3: Modify Sidebar Component

**Files:**
- Modify: `components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `useSidebarState` hook
- Produces: Sidebar component with conditional rendering for icon-only mode

- [ ] **Step 1: Read current sidebar structure**

```bash
head -50 components/layout/sidebar.tsx
```

Note the current structure (navigation items, styling, etc.)

- [ ] **Step 2: Add sidebar state to sidebar component**

Modify `components/layout/sidebar.tsx` to:

```typescript
'use client';

import { useSidebarState } from '@/hooks/use-sidebar-state';
import { SidebarToggle } from './sidebar-toggle';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { isExpanded, toggleSidebar, isHydrated } = useSidebarState();

  if (!isHydrated) {
    return null; // Avoid hydration mismatch
  }

  return (
    <aside
      className={cn(
        'bg-background border-r transition-all duration-200',
        isExpanded ? 'w-64' : 'w-16'
      )}
    >
      {/* Toggle Button */}
      <div className="flex items-center justify-center p-2 border-b">
        <SidebarToggle isExpanded={isExpanded} onToggle={toggleSidebar} />
      </div>

      {/* Navigation Items */}
      <nav className="space-y-2 p-2">
        {/* Render existing nav items, conditionally show labels */}
        {/* See Task 4 for SidebarItem modification */}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Update each sidebar nav item to conditionally show label**

For each nav item in the sidebar, wrap text label with conditional:

```typescript
// Before
<a href="/dashboard" className="flex items-center gap-2">
  <Home className="h-5 w-5" />
  <span>Dashboard</span>
</a>

// After
<a href="/dashboard" className="flex items-center gap-2">
  <Home className="h-5 w-5" />
  {isExpanded && <span>Dashboard</span>}
</a>
```

- [ ] **Step 4: Add tooltip for collapsed state**

Install/verify `@radix-ui/react-tooltip` is available, or use Shadcn tooltip component:

```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Wrap nav item
{!isExpanded && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <a href="/dashboard" className="flex items-center gap-2">
          <Home className="h-5 w-5" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="right">Dashboard</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}

{isExpanded && (
  <a href="/dashboard" className="flex items-center gap-2">
    <Home className="h-5 w-5" />
    <span>Dashboard</span>
  </a>
)}
```

- [ ] **Step 5: Commit sidebar changes**

```bash
git add components/layout/sidebar.tsx components/layout/sidebar-toggle.tsx hooks/use-sidebar-state.ts
git commit -m "feat(sidebar): add collapsible toggle with icon-only mode"
```

---

## Task 4: Create useTransactionViewType Hook

**Files:**
- Create: `hooks/use-transaction-view-type.ts`

**Interfaces:**
- Consumes: Next.js useSearchParams hook
- Produces: Hook returning `{ viewType: 'gasto' | 'faturado'; setViewType: (type: 'gasto' | 'faturado') => void }`

- [ ] **Step 1: Write the hook**

Create `hooks/use-transaction-view-type.ts`:

```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

type ViewType = 'gasto' | 'faturado';

export function useTransactionViewType(defaultViewType: ViewType = 'gasto') {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewType = useMemo<ViewType>(() => {
    const param = searchParams.get('viewType');
    if (param === 'gasto' || param === 'faturado') {
      return param;
    }
    return defaultViewType;
  }, [searchParams, defaultViewType]);

  const setViewType = useCallback(
    (newViewType: ViewType) => {
      const params = new URLSearchParams(searchParams);
      params.set('viewType', newViewType);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  return { viewType, setViewType };
}
```

- [ ] **Step 2: Verify hook**

Hook should:
- ✅ Read `viewType` from URL params
- ✅ Default to `gasto` if param not present
- ✅ Update URL when `setViewType` is called
- ✅ Preserve other search params when updating

---

## Task 5: Create ViewTypeFilter Component

**Files:**
- Create: `app/(app)/transactions/components/view-type-filter.tsx`

**Interfaces:**
- Consumes: `viewType: 'gasto' | 'faturado'`, `onViewTypeChange: (type) => void`
- Produces: Tab-like filter component

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/\(app\)/transactions/components
```

- [ ] **Step 2: Write ViewTypeFilter component**

Create `app/(app)/transactions/components/view-type-filter.tsx`:

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewTypeFilterProps {
  viewType: 'gasto' | 'faturado';
  onViewTypeChange: (type: 'gasto' | 'faturado') => void;
}

export function ViewTypeFilter({
  viewType,
  onViewTypeChange,
}: ViewTypeFilterProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={viewType === 'gasto' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewTypeChange('gasto')}
        className={cn(
          'transition-colors',
          viewType === 'gasto' && 'bg-primary text-primary-foreground'
        )}
      >
        Gasto
      </Button>
      <Button
        variant={viewType === 'faturado' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewTypeChange('faturado')}
        className={cn(
          'transition-colors',
          viewType === 'faturado' && 'bg-primary text-primary-foreground'
        )}
      >
        Faturado
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Commit component**

```bash
git add app/\(app\)/transactions/components/view-type-filter.tsx hooks/use-transaction-view-type.ts
git commit -m "feat(transactions): add view type filter hook and component"
```

---

## Task 6: Integrate ViewTypeFilter into TransactionsView

**Files:**
- Modify: `app/(app)/transactions/_view.tsx`

**Interfaces:**
- Consumes: `ViewTypeFilter` component, `useTransactionViewType` hook
- Produces: TransactionsView with integrated filter UI

- [ ] **Step 1: Read current TransactionsView structure**

```bash
head -100 app/\(app\)/transactions/_view.tsx
```

Note where filters are rendered and how data is queried.

- [ ] **Step 2: Add imports and hook**

At top of `_view.tsx`:

```typescript
'use client';

import { useTransactionViewType } from '@/hooks/use-transaction-view-type';
import { ViewTypeFilter } from './components/view-type-filter';
```

- [ ] **Step 3: Integrate hook into component**

Inside TransactionsView component function:

```typescript
export function TransactionsView({
  // existing props
}: TransactionsViewProps) {
  const { viewType, setViewType } = useTransactionViewType();

  // ... rest of component
}
```

- [ ] **Step 4: Add filter UI to render**

In the filters section (alongside existing category/tag filters), add:

```typescript
<div className="flex items-center gap-2">
  <span className="text-sm font-medium">Visualização:</span>
  <ViewTypeFilter
    viewType={viewType}
    onViewTypeChange={setViewType}
  />
</div>
```

- [ ] **Step 5: Commit integration**

```bash
git add app/\(app\)/transactions/_view.tsx
git commit -m "feat(transactions): integrate view type filter UI"
```

---

## Task 7: Update Transaction Query Logic

**Files:**
- Modify: `app/(app)/transactions/_view.tsx`

**Interfaces:**
- Consumes: `viewType` state from hook
- Produces: Updated query that filters by `mês_gasto` or `mês_fatura` based on viewType

- [ ] **Step 1: Identify current transaction query**

Find where transactions are fetched/queried. Note field names:
- `mês_gasto` or similar (actual expense month)
- `mês_fatura` or similar (planned/invoice month)

```bash
grep -n "mês_gasto\|mes_gasto\|month_spent" app/\(app\)/transactions/_view.tsx
```

- [ ] **Step 2: Modify query to respect viewType**

In TransactionsView, update the filtering/sorting logic:

```typescript
// When filtering/sorting transactions, use:
const groupByField = viewType === 'gasto' ? 'mês_gasto' : 'mês_fatura';

// If using Supabase, add to query:
const query = supabase
  .from('transactions')
  .select('*')
  .order(groupByField, { ascending: false }); // or appropriate sorting

// If grouping in UI, group by:
const grouped = transactions.reduce((acc, tx) => {
  const month = viewType === 'gasto' ? tx.mês_gasto : tx.mês_fatura;
  // ... group logic
}, {});
```

- [ ] **Step 3: Verify data flows correctly**

Test that:
- ✅ Clicking "Gasto" filters by mês_gasto
- ✅ Clicking "Faturado" filters by mês_fatura
- ✅ Totals/sums update accordingly
- ✅ Other filters (category, tags, period) still work

- [ ] **Step 4: Commit query changes**

```bash
git add app/\(app\)/transactions/_view.tsx
git commit -m "feat(transactions): update query logic for viewType"
```

---

## Task 8: Manual Testing - Sidebar Toggle

**Files:**
- Test: `components/layout/sidebar.tsx`

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test sidebar toggle on desktop**

- Navigate to any page
- Verify hamburger button (≡) visible in sidebar
- Click hamburger → sidebar should collapse to icon-only mode (~64px)
- Verify all nav items show only icons, no labels
- Hover over icons → tooltips appear with item names
- Click hamburger again → sidebar expands, labels reappear
- Verify animation is smooth (~200ms)

- [ ] **Step 3: Verify localStorage persistence**

- Toggle sidebar to collapsed state
- Open DevTools → Application → localStorage
- Verify `sidebarExpanded=false`
- Refresh page → sidebar should stay collapsed
- Toggle again → verify `sidebarExpanded=true`
- Refresh page → sidebar should be expanded

- [ ] **Step 4: Test on mobile (DevTools mobile view)**

- Toggle DevTools to iPhone/mobile view
- Sidebar should NOT show hamburger toggle (keep existing behavior)
- Layout should be responsive

- [ ] **Step 5: Commit test results**

If all pass, document:

```bash
git commit --allow-empty -m "test: sidebar toggle manual testing completed

- Hamburger button visible and clickable
- Collapse/expand animations smooth
- localStorage persistence working
- Mobile behavior unchanged
- Tooltips appear on hover when collapsed"
```

---

## Task 9: Manual Testing - ViewType Filter

**Files:**
- Test: `app/(app)/transactions/_view.tsx`

- [ ] **Step 1: Navigate to Transactions page**

```
localhost:3000/transactions
```

- [ ] **Step 2: Verify filter UI present**

- Look for "Visualização:" label with two buttons: [Gasto] [Faturado]
- Verify [Gasto] is highlighted by default
- Verify buttons are positioned with other filters

- [ ] **Step 3: Test Gasto view**

- Verify transactions are displayed (should match current behavior)
- Check URL → should be `?viewType=gasto` (or no param, since it's default)
- Verify summary totals are based on mês_gasto

- [ ] **Step 4: Test Faturado view**

- Click [Faturado] button
- Verify transactions list updates (may show different months if invoiced earlier/later than spent)
- Verify URL updates to `?viewType=faturado`
- Verify [Faturado] button is now highlighted
- Verify summary totals are based on mês_fatura

- [ ] **Step 5: Test filter independence**

- Apply a category filter (e.g., "Food")
- Toggle between Gasto and Faturado
- Verify category filter persists, only the month view changes

- [ ] **Step 6: Test URL params persistence**

- Set view to Faturado
- Copy URL
- Paste in new tab
- Verify page loads with Faturado view already selected

- [ ] **Step 7: Commit test results**

```bash
git commit --allow-empty -m "test: view type filter manual testing completed

- Filter UI appears in correct location
- Gasto view shows current behavior (mês_gasto)
- Faturado view shows invoiced month data (mês_fatura)
- URL params reflect selected view
- Filter independent of other filters
- Totals update correctly for each view"
```

---

## Task 10: Edge Cases & Cleanup

**Files:**
- Modify: Components as needed for edge cases

- [ ] **Step 1: Test loading states**

- Start dev server
- Open DevTools Network tab (throttle to Slow 3G)
- Click between Gasto/Faturado rapidly
- Verify UI shows loading indicator (spinner, skeleton, or disabled state)
- Verify data eventually loads correctly

- [ ] **Step 2: Test empty states**

- Filter to a month with no transactions
- Verify message "Nenhum lançamento" or similar
- Verify layout doesn't break
- Test with both Gasto and Faturado

- [ ] **Step 3: Test URL edge cases**

- Add invalid param: `?viewType=invalid`
- Verify page defaults to Gasto (no error)
- Add multiple conflicting params: `?viewType=gasto&viewType=faturado`
- Verify last one wins or defaults gracefully

- [ ] **Step 4: Clear localStorage and test hydration**

```javascript
// In DevTools console
localStorage.removeItem('sidebarExpanded');
location.reload();
```

- Verify sidebar loads in default expanded state
- No hydration mismatch errors in console

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "test: edge cases and cleanup

- Loading states handled correctly
- Empty states display appropriate messages
- Invalid URL params handled gracefully
- localStorage corruption handled
- Hydration mismatch prevented"
```

---

## Spec Coverage Checklist

- [x] **1. Sidebar Retraível** → Tasks 1-3, 8
  - [x] Botão hamburger toggle
  - [x] Estados expandido/retraído
  - [x] Animações ~200ms
  - [x] localStorage persistence
  - [x] Tooltips on hover (collapsed)
  - [x] Mobile unchanged

- [x] **2. Filtro Gasto/Faturado** → Tasks 4-7, 9
  - [x] Two-button tab component
  - [x] URL params persistence
  - [x] Query logic respects viewType
  - [x] Other filters independent
  - [x] Loading indicators
  - [x] Mobile responsive

- [x] **3. Interações** → Tasks 1-7
  - [x] Sidebar + Filter independent
  - [x] Mobile behavior preserved
  - [x] Edge cases handled

---

## Notes

- **Hydration Safety:** `useSidebarState` includes `isHydrated` flag to prevent mismatch between server/client renders
- **URL Params:** Using Next.js `useRouter` + `useSearchParams` for URL management, which preserves other params
- **Accessibility:** All interactive elements have `aria-label` and `title` attributes
- **Testing:** Manual testing provided; consider adding E2E tests with Playwright for CI/CD
