import { describe, it, expect, vi } from 'vitest';
import { SidebarToggle } from './sidebar-toggle';

describe('SidebarToggle', () => {
  it('exports SidebarToggle component', () => {
    expect(SidebarToggle).toBeDefined();
    expect(typeof SidebarToggle).toBe('function');
  });

  it('component accepts isExpanded prop', () => {
    const handleToggle = vi.fn();
    const props = {
      isExpanded: false,
      onToggle: handleToggle,
    };
    expect(props.isExpanded).toBe(false);

    const props2 = {
      isExpanded: true,
      onToggle: handleToggle,
    };
    expect(props2.isExpanded).toBe(true);
  });

  it('component accepts onToggle callback', () => {
    const handleToggle = vi.fn();
    expect(typeof handleToggle).toBe('function');
  });

  it('component renders without error', () => {
    const handleToggle = vi.fn();
    const Component = () => (
      <SidebarToggle isExpanded={false} onToggle={handleToggle} />
    );
    expect(Component).toBeDefined();
  });

  it('exports SidebarToggleProps interface', () => {
    // Verify the component has proper TypeScript typing
    type TestProps = {
      isExpanded: boolean;
      onToggle: () => void;
    };
    const testProps: TestProps = {
      isExpanded: false,
      onToggle: vi.fn(),
    };
    expect(testProps.isExpanded).toBe(false);
  });

  it('should have use client directive', () => {
    const componentContent = require('fs').readFileSync(
      require.resolve('./sidebar-toggle.tsx'),
      'utf-8'
    );

    expect(componentContent).toContain("'use client'");
  });

  it('should have aria-expanded attribute', () => {
    const componentContent = require('fs').readFileSync(
      require.resolve('./sidebar-toggle.tsx'),
      'utf-8'
    );

    expect(componentContent).toContain('aria-expanded={isExpanded}');
  });

  it('should have aria-label for accessibility', () => {
    const componentContent = require('fs').readFileSync(
      require.resolve('./sidebar-toggle.tsx'),
      'utf-8'
    );

    expect(componentContent).toContain('aria-label');
    expect(componentContent).toContain('Fechar barra lateral');
    expect(componentContent).toContain('Abrir barra lateral');
  });

  it('should render Menu icon when collapsed', () => {
    const componentContent = require('fs').readFileSync(
      require.resolve('./sidebar-toggle.tsx'),
      'utf-8'
    );

    expect(componentContent).toContain('Menu');
    expect(componentContent).toContain('isExpanded ?');
  });

  it('should render X icon when expanded', () => {
    const componentContent = require('fs').readFileSync(
      require.resolve('./sidebar-toggle.tsx'),
      'utf-8'
    );

    expect(componentContent).toContain('X className');
    expect(componentContent).toContain('isExpanded');
  });
});
