import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { getAppPath } from './utils/appPath';

test('renders the warehouse welcome page', () => {
  render(<App />);
  const welcomeText = screen.getByText(/Chào mừng đến với hệ thống quản lý xuất nhập hàng/i);
  expect(welcomeText).toBeInTheDocument();
});

test('opens a direct page URL and navigates without a hash', async () => {
  const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  try {
    window.history.replaceState(null, '', getAppPath('/login'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    expect(window.location.pathname).toBe(getAppPath('/forgot-password'));
    expect(window.location.hash).toBe('');
  } finally {
    window.history.replaceState(null, '', originalUrl);
  }
});
