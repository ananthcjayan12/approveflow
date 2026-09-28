export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) }
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function uploadFile(file: File, onProgress?: (percent: number) => void) {
  const singleThreshold = 100 * 1024 * 1024;
  if (file.size <= singleThreshold) {
    const result = await api<{ url: string; key: string }>('/api/uploads/single/presign', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size })
    });
    await fetch(result.url, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
    onProgress?.(100);
    return result;
  }

  const create = await api<{ key: string; uploadId: string; partSize: number }>('/api/uploads/multipart/create', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size })
  });
  const partSize = create.partSize;
  const parts: Array<{ partNumber: number; etag: string }> = [];
  const totalParts = Math.ceil(file.size / partSize);
  let completed = 0;

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(file.size, start + partSize);
    const signed = await api<{ url: string }>('/api/uploads/multipart/part-url', {
      method: 'POST',
      body: JSON.stringify({ key: create.key, uploadId: create.uploadId, partNumber })
    });
    const response = await fetch(signed.url, { method: 'PUT', body: file.slice(start, end) });
    if (!response.ok) throw new Error(`Part ${partNumber} failed`);
    parts.push({ partNumber, etag: response.headers.get('etag') || '' });
    completed += 1;
    onProgress?.(Math.round((completed / totalParts) * 100));
  };

  let next = 1;
  const workers = Array.from({ length: Math.min(4, totalParts) }, async () => {
    while (next <= totalParts) {
      const current = next++;
      await uploadPart(current);
    }
  });
  await Promise.all(workers);
  parts.sort((a, b) => a.partNumber - b.partNumber);

  await api('/api/uploads/multipart/complete', {
    method: 'POST',
    body: JSON.stringify({ key: create.key, uploadId: create.uploadId, parts })
  });
  return { key: create.key };
}
