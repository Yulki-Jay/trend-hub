'use client';

export async function adminFetch(input, init = {}) {
  const response = await fetch(input, {
    ...init,
    cache: init.cache || 'no-store',
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (response.status === 401) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    throw new Error('登录状态已失效');
  }
  return response;
}
