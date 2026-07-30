import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import {
  createUser,
  deleteDisabledUser,
  getCurrentUser,
  hashPassword,
  normalizeEmail,
  validateUsername,
  verifyUserPassword,
} from '../../../../lib/user-auth';
import db from '../../../../lib/db';
import { audit, validatePassword } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

function duplicateField(username, email, excludeId = 0) {
  const row = db.prepare(`
    SELECT id,username,email FROM users
    WHERE id!=? AND (username=? COLLATE NOCASE OR email=? COLLATE NOCASE)
    LIMIT 1
  `).get(excludeId, username, email);
  if (!row) return null;
  return row.username.toLowerCase() === username.toLowerCase() ? 'username' : 'email';
}

function validateProfile(body, fallback = {}) {
  const username = validateUsername(body.username ?? fallback.username);
  const email = normalizeEmail(body.email ?? fallback.email);
  const displayName = String(body.display_name ?? fallback.display_name ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('请输入有效邮箱');
  if (displayName.length < 1 || displayName.length > 50) throw new Error('昵称长度需要为 1～50 位');
  return { username, email, displayName };
}

export async function GET(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').trim();
  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize')) || 20));
  let where = ' WHERE 1=1';
  const params = [];
  if (q) {
    where += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (role === 'admin' || role === 'user') { where += ' AND u.role=?'; params.push(role); }
  if (status === 'active') where += ' AND u.disabled=0';
  if (status === 'disabled') where += ' AND u.disabled=1';

  const total = db.prepare(`SELECT COUNT(*) count FROM users u${where}`).get(...params).count;
  const items = db.prepare(`
    SELECT u.id,u.username,u.email,u.display_name,u.role,u.disabled,u.created_at,u.updated_at,
      (SELECT COUNT(*) FROM user_favorites f WHERE f.user_id=u.id) favorite_count,
      (SELECT MAX(created_at) FROM user_sessions s WHERE s.user_id=u.id) last_login_at
    FROM users u ${where} ORDER BY u.id DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  const summary = db.prepare(`
    SELECT COUNT(*) total,
      SUM(CASE WHEN disabled=0 THEN 1 ELSE 0 END) active,
      SUM(CASE WHEN disabled=1 THEN 1 ELSE 0 END) disabled,
      SUM(CASE WHEN role='admin' AND disabled=0 THEN 1 ELSE 0 END) admins
    FROM users
  `).get();
  return NextResponse.json({
    items,
    summary,
    currentUserId: getCurrentUser().id,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const profile = validateProfile(body);
    const duplicate = duplicateField(profile.username, profile.email);
    if (duplicate) return NextResponse.json({ error: duplicate === 'username' ? '用户名已被使用' : '邮箱已被使用', field: duplicate }, { status: 409 });
    const role = body.role === 'admin' ? 'admin' : 'user';
    const disabled = body.disabled ? 1 : 0;
    const current = getCurrentUser();
    if (role === 'admin' && !verifyUserPassword(current.id, body.admin_password)) {
      return NextResponse.json({ error: '创建管理员需要验证你的当前密码' }, { status: 403 });
    }
    const user = createUser({
      username: profile.username,
      email: profile.email,
      displayName: profile.displayName,
      password: body.password,
    });
    db.prepare('UPDATE users SET role=?,disabled=? WHERE id=?').run(role, disabled, user.id);
    audit({
      actorUserId: current.id,
      action: role === 'admin' ? 'admin.user_created_as_admin' : 'admin.user_created',
      targetUserId: user.id,
      request: req,
      metadata: { role, disabled: !!disabled },
    });
    return NextResponse.json({ ok: true, user: { ...user, role, disabled } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const current = getCurrentUser();
  try {
    const body = await req.json();
    const id = Number(body.id);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: '用户参数错误' }, { status: 400 });
    if (!verifyUserPassword(current.id, body.admin_password)) {
      audit({ actorUserId: current.id, action: 'admin.user_change_denied', targetUserId: id, request: req });
      return NextResponse.json({ error: '请验证你的管理员当前密码后再保存' }, { status: 403 });
    }
    const profile = validateProfile(body, target);
    const duplicate = duplicateField(profile.username, profile.email, id);
    if (duplicate) return NextResponse.json({ error: duplicate === 'username' ? '用户名已被使用' : '邮箱已被使用', field: duplicate }, { status: 409 });

    const nextRole = body.role === undefined ? target.role : body.role === 'admin' ? 'admin' : 'user';
    const nextDisabled = body.disabled === undefined ? target.disabled : body.disabled ? 1 : 0;
    if (id === current.id && (nextRole !== target.role || nextDisabled !== target.disabled)) {
      return NextResponse.json({ error: '不能在用户管理中修改自己的角色或状态' }, { status: 400 });
    }
    if (target.role === 'admin' && id !== current.id) {
      const profileChanged = profile.username !== target.username || profile.email !== target.email ||
        profile.displayName !== target.display_name;
      if (profileChanged || body.new_password) {
        return NextResponse.json({ error: '不能修改其他管理员的资料或密码，请由该管理员在个人账号中操作' }, { status: 403 });
      }
    }
    if (target.role === 'admin' && (nextDisabled || nextRole !== 'admin')) {
      const others = db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin' AND disabled=0 AND id!=?").get(id).count;
      if (!others) return NextResponse.json({ error: '系统必须保留至少一名可用管理员' }, { status: 400 });
    }

    const profileChanged = profile.username !== target.username || profile.email !== target.email ||
      profile.displayName !== target.display_name;
    const roleChanged = nextRole !== target.role;
    const statusChanged = nextDisabled !== target.disabled;

    let passwordHash = target.password_hash;
    if (body.new_password) {
      const password = validatePassword(body.new_password, {
        username: profile.username,
        email: profile.email,
        displayName: profile.displayName,
      });
      passwordHash = hashPassword(password);
    }
    const update = db.transaction(() => {
      db.prepare(`
        UPDATE users SET username=?,email=?,display_name=?,role=?,disabled=?,password_hash=?,
          must_change_password=CASE WHEN ? THEN 1 ELSE must_change_password END,
          updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(profile.username, profile.email, profile.displayName, nextRole, nextDisabled, passwordHash, body.new_password ? 1 : 0, id);
      if (profileChanged || roleChanged || statusChanged || body.new_password) {
        db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(id);
      }
    });
    update();
    audit({
      actorUserId: current.id,
      action: body.new_password ? 'admin.user_password_reset' : 'admin.user_updated',
      targetUserId: id,
      request: req,
      metadata: {
        roleChanged,
        statusChanged,
        profileChanged,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const current = getCurrentUser();
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: '用户参数错误' }, { status: 400 });
    }
    if (id === current.id) {
      return NextResponse.json({ error: '不能删除当前登录账号' }, { status: 400 });
    }
    const target = db.prepare('SELECT id,username,role,disabled FROM users WHERE id=?').get(id);
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (!target.disabled) {
      return NextResponse.json({ error: '请先停用该用户，再执行永久删除' }, { status: 400 });
    }
    if (!verifyUserPassword(current.id, body.admin_password)) {
      audit({ actorUserId: current.id, action: 'admin.user_delete_denied', targetUserId: id, request: req });
      return NextResponse.json({ error: '永久删除用户需要验证你的管理员当前密码' }, { status: 403 });
    }

    const deleted = deleteDisabledUser(id);
    audit({
      actorUserId: current.id,
      action: 'admin.user_deleted',
      targetUserId: id,
      request: req,
      metadata: { username: deleted.username, role: deleted.role },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
