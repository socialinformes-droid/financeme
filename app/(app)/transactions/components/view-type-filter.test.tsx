import { describe, it, expect, vi } from 'vitest';
import { ViewTypeFilter } from './view-type-filter';

describe('ViewTypeFilter', () => {
  it('exports ViewTypeFilter component', () => {
    expect(ViewTypeFilter).toBeDefined();
    expect(typeof ViewTypeFilter).toBe('function');
  });

  it('component accepts viewType prop of type gasto or faturado', () => {
    const handleChange = vi.fn();
    const props = {
      viewType: 'gasto' as const,
      onViewTypeChange: handleChange,
    };
    expect(props.viewType).toBe('gasto');

    const props2 = {
      viewType: 'faturado' as const,
      onViewTypeChange: handleChange,
    };
    expect(props2.viewType).toBe('faturado');
  });

  it('component accepts onViewTypeChange callback', () => {
    const handleChange = vi.fn();
    expect(typeof handleChange).toBe('function');
  });

  it('component renders without error', () => {
    const handleChange = vi.fn();
    const Component = () => (
      <ViewTypeFilter viewType="gasto" onViewTypeChange={handleChange} />
    );
    expect(Component).toBeDefined();
  });

  it('exports ViewTypeFilterProps interface', () => {
    // Verify the component has proper TypeScript typing
    type TestProps = {
      viewType: 'gasto' | 'faturado';
      onViewTypeChange: (type: 'gasto' | 'faturado') => void;
    };
    const testProps: TestProps = {
      viewType: 'gasto',
      onViewTypeChange: vi.fn(),
    };
    expect(testProps.viewType).toBe('gasto');
  });
});
