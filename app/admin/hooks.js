'use client';
import { useEffect, useState } from 'react';

export function useAdminSettings() {
  const [settings, setSettings] = useState(null);
  const load = () => fetch('/api/admin/settings').then((r) => r.json()).then(setSettings);
  useEffect(() => { load(); }, []);
  const save = async (patch) => {
    const response = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error((await response.json()).error || '保存失败');
    setSettings((current) => ({ ...current, ...patch }));
  };
  return { settings, setSettings, save, reload: load };
}

export function useFlash() {
  const [message, setMessage] = useState('');
  const flash = (text) => { setMessage(text); setTimeout(() => setMessage(''), 2600); };
  return { message, flash };
}

export async function runAdminAction(payload) {
  const response = await fetch('/api/admin/actions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}
