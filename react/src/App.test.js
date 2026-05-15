import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (url.includes('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ devices: [] }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });
  });
});

test('renders privacy dots dashboard', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /All Sensors/i })).toBeInTheDocument();
  expect(screen.getByText(/No motion events yet/i)).toBeInTheDocument();
  expect(await screen.findByText(/Connected/i)).toBeInTheDocument();
});
