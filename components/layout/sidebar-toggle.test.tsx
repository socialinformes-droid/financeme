import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarToggle } from './sidebar-toggle';

describe('SidebarToggle', () => {
  it('renders Menu icon when collapsed', () => {
    render(
      <SidebarToggle isExpanded={false} onToggle={() => {}} />
    );

    const icon = screen.getByRole('button').querySelector('svg');
    expect(icon).toBeInTheDocument();
    // Menu icon should be visible (aria-label for Menu)
    expect(screen.getByLabelText('Abrir barra lateral')).toBeInTheDocument();
  });

  it('renders X icon when expanded', () => {
    render(
      <SidebarToggle isExpanded={true} onToggle={() => {}} />
    );

    const button = screen.getByLabelText('Fechar barra lateral');
    expect(button).toBeInTheDocument();
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();

    render(
      <SidebarToggle isExpanded={false} onToggle={onToggle} />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded correctly', () => {
    const { rerender } = render(
      <SidebarToggle isExpanded={false} onToggle={() => {}} />
    );

    let button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <SidebarToggle isExpanded={true} onToggle={() => {}} />
    );

    button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
