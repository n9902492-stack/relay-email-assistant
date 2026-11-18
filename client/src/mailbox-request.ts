export async function requestMailbox<T>(path = '', method = 'GET', body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/mailbox' + path, {
    method, signal,
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Mailbox request failed.');
  return result as T;
}
