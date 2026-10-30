import { getAppPath, migrateLegacyHashRoute } from './appPath';

test('converts an existing hash bookmark to a clean route', () => {
  const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  try {
    window.history.replaceState(null, '', `${getAppPath('/')}#/sales-invoices?status=draft`);
    expect(migrateLegacyHashRoute()).toBe(true);
    expect(window.location.pathname).toBe(getAppPath('/sales-invoices'));
    expect(window.location.search).toBe('?status=draft');
    expect(window.location.hash).toBe('');
  } finally {
    window.history.replaceState(null, '', originalUrl);
  }
});
