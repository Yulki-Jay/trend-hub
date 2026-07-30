export const metadata = { title: '无权访问 · TrendHub' };

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-5 text-2xl font-bold">无权访问管理后台</h1>
        <p className="mt-2 text-sm text-slate-500">当前账号是普通用户，管理数据、其他用户资料和系统配置仅对管理员开放。</p>
        <div className="mt-6 flex justify-center gap-3">
          <a href="/" className="btn">返回首页</a>
          <a href="/account" className="btn-ghost">个人账号</a>
        </div>
      </div>
    </div>
  );
}
