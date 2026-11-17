const API_BASE_URL = 'https://expertise-int-ranging-fixes.trycloudflare.com';

export async function fetchRecords() {
  const response = await fetch(`${API_BASE_URL}/api/data`);
  if (!response.ok) throw new Error('Failed to fetch from PC database');
  return response.json();
}

export async function createRecord(payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}/api/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to save to PC database');
  return response.json();
}
