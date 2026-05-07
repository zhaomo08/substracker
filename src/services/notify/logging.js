function maskValue(value = '') {
  const text = String(value || '').trim();
  if (!text) return '(empty)';
  if (text.length <= 8) return '***';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

async function readSafeResponse(response) {
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => '');
}

export { maskValue, readSafeResponse };
