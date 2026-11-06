import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '../sidebar';

jest.mock('next/navigation', () => ({ usePathname: () => '/admin/dashboard' }));
jest.mock('@/lib/admin/api', () => ({ pipelineApi: { getOverview: jest.fn().mockResolvedValue({}) } }));

it('links to the maintenance page in the deployed admin dashboard', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Sidebar mobileOpen={false} onMobileClose={() => {}} />
    </QueryClientProvider>
  );
  const links = screen.getAllByRole('link', { name: /Maintenance/ });
  expect(links[0]).toHaveAttribute('href', '/admin/dashboard/maintenance');
});
