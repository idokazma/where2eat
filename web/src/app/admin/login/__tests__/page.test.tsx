import { render, screen } from '@testing-library/react';
import AdminLoginPage from '../page';

jest.mock('@/lib/admin/auth-context', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('admin login page', () => {
  it('does not publish any credential hint', () => {
    const { container } = render(<AdminLoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/default credentials/i);
    expect(container.textContent).not.toMatch(/@where2eat\.com/i);
  });
});
