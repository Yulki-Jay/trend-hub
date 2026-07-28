import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { getCurrentUser } from '../../../../lib/user-auth';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = db.prepare(`
    SELECT u.id,u.username,u.email,u.display_name,u.role,u.disabled,u.created_at,
      (SELECT COUNT(*) FROM user_favorites f WHERE f.user_id=u.id) favorite_count
    FROM users u ORDER BY u.id DESC
  `).all();
  return NextResponse.json({ items, currentUserId: getCurrentUser().id });
}

export async function PATCH(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const current = getCurrentUser();
  const body = await req.json();
  const id = Number(body.id);
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  if (id === current.id) return NextResponse.json({ error: '不能在用户管理中修改当前管理员' }, { status: 400 });

  if (body.role !== undefined) {
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (target.role === 'admin' && role !== 'admin') {
      const admins = db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin' AND disabled=0").get().count;
      if (admins <= 1) return NextResponse.json({ error: '系统必须保留至少一名管理员' }, { status: 400 });
    }
    db.prepare('UPDATE users SET role=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(role, id);
  }
  if (body.disabled !== undefined) {
    if (target.role === 'admin' && body.disabled) {
      const admins = db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin' AND disabled=0").get().count;
      if (admins <= 1) return NextResponse.json({ error: '系统必须保留至少一名可用管理员' }, { status: 400 });
    }
    db.prepare('UPDATE users SET disabled=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
      .run(body.disabled ? 1 : 0, id);
    if (body.disabled) db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(id);
  }
  return NextResponse.json({ ok: true });
}
