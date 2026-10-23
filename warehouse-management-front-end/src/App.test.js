import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the warehouse welcome page', () => {
  render(<App />);
  const welcomeText = screen.getByText(/Chào mừng đến với hệ thống quản lý xuất nhập hàng/i);
  expect(welcomeText).toBeInTheDocument();
});
