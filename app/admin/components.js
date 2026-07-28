export function PageHeader({ eyebrow = 'TrendHub Admin', title, desc, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {desc && <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, desc, children, action, className = '' }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {desc && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm text-white shadow-xl">{message}</div>;
}

export function StatusBadge({ status }) {
  const ok = status === 'success';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ok
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>{ok ? '正常' : '异常'}</span>;
}

export function Loading() {
  return <div className="py-24 text-center text-sm text-slate-400">加载中…</div>;
}
