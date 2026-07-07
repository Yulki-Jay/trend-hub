// 搜索工具：将查询拆成多个关键词，对指定字段做 AND 模糊匹配
// 返回 { clause, params }，clause 形如 "AND (a LIKE ? OR b LIKE ?) AND (a LIKE ? OR b LIKE ?)"
function buildSearch(q, fields) {
  const terms = String(q || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8); // 最多 8 个词，避免滥用

  if (!terms.length) return { clause: '', params: [] };

  const parts = [];
  const params = [];
  for (const t of terms) {
    const like = `%${t}%`;
    parts.push('(' + fields.map((f) => `${f} LIKE ?`).join(' OR ') + ')');
    for (let i = 0; i < fields.length; i++) params.push(like);
  }
  return { clause: ' AND ' + parts.join(' AND '), params };
}

// 相关度排序：标题命中优先。返回 { expr, params }，用于 ORDER BY 前缀
function buildRelevance(q, titleField) {
  const terms = String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return { expr: '', params: [] };
  const parts = terms.map(() => `(CASE WHEN ${titleField} LIKE ? THEN 1 ELSE 0 END)`);
  const params = terms.map((t) => `%${t}%`);
  return { expr: `(${parts.join(' + ')}) DESC, `, params };
}

module.exports = { buildSearch, buildRelevance };
