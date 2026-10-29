/** 标签库前端辅助：适用范围、必填校验、选择器数据。 */

export const SCOPE_TEXT = 'text'
export const SCOPE_WALLPAPER = 'wallpaper'
export const SCOPE_BOTH = 'both'

export function scopeLabel(scope) {
  return { text: '文字', wallpaper: '壁纸', both: '文字／壁纸' }[scope] || scope
}

export function typeApplies(type, surface) {
  if (!type) return false
  if (type.scope === SCOPE_BOTH) return true
  return type.scope === surface
}

export function zhTypeLabel(type) {
  return type?.label_zh || type?.label || ''
}

export function enabledTagsOf(tags, typeKey) {
  return (tags || []).filter((t) => t.type === typeKey && t.enabled)
}

export function missingRequiredTypes(types, surface, getter) {
  return (types || [])
    .filter((t) => t.required && typeApplies(t, surface))
    .filter((t) => !(getter(t.key) || []).length)
    .map((t) => zhTypeLabel(t))
}

export function missingTriple(en, es, pt) {
  return missingEnglish(en)
}

export function missingEnglish(en) {
  return String(en || '').trim() ? [] : ['English']
}

export function quoteValues(row, typeKey) {
  if (typeKey === 'content') return row.content_type ? [row.content_type] : []
  if (typeKey === 'theme') return row.theme ? [row.theme] : []
  if (typeKey === 'scenario') return row.scenario_tags || []
  if (typeKey === 'emotion') return row.emotion_tags || []
  return (row.taxonomy || {})[typeKey] || []
}

export function wallpaperValues(row, typeKey) {
  if (typeKey === 'theme') return row.theme ? [row.theme] : []
  if (typeKey === 'visual') return row.visual_tags || []
  if (typeKey === 'scenario') return row.scenario_tags || []
  if (typeKey === 'emotion') return row.emotion_tags || []
  return (row.taxonomy || {})[typeKey] || []
}

/** 选择器：已启用 + 当前已选（含停用，避免编辑页丢值） */
export function withSelectedTags(tags, typeKey, selected) {
  const enabled = enabledTagsOf(tags, typeKey)
  const names = new Set(enabled.map((t) => t.name))
  const extra = []
    .concat(selected || [])
    .filter(Boolean)
    .filter((name) => !names.has(name))
    .map((name) => (tags || []).find((t) => t.type === typeKey && t.name === name) || {
      name, type: typeKey, enabled: false, code: '已停用',
    })
  return [...extra, ...enabled]
}

export function publishedDisplays(rows, selectedNames = []) {
  const published = (rows || []).filter((r) => r.status === 'published')
  const names = new Set(published.map((r) => r.name_en))
  const extra = (rows || []).filter((r) => (selectedNames || []).includes(r.name_en) && !names.has(r.name_en))
  return [...extra, ...published]
}

export function validateDisplayForm(form, itemLabel, { requireRule = true } = {}) {
  if (missingEnglish(form.name_en).length) return '请填写 English 展示名称'
  const sort = Number(form.sort)
  if (!Number.isInteger(sort) || sort < 1) return '显示排序必须为大于 0 的整数'
  if (!requireRule) return ''
  if (form.mode === 'auto' && !(form.conditions || []).length) return '请至少选择一个自动收录条件'
  if (form.mode === 'manual' && !(form.manual_ids || []).length) return `请至少选择一条${itemLabel}`
  return ''
}

export function conditionText(row, types = []) {
  if (row.mode === 'manual') return row.display_type === 'column' ? '手动选择文字合集标题' : '手动选择内容'
  if (!row.conditions?.length) return '尚未配置'
  const rel = row.match === 'all' ? '且' : '或'
  return (row.conditions || []).map((c) => {
    const type = types.find((t) => t.key === c.type)
    return `${zhTypeLabel(type) || c.type} = ${c.name}`
  }).join(` ${rel} `)
}

export function matchesRule(valuesForType, row) {
  if (row.mode === 'manual') return (row.manual_ids || []).map(Number).includes(Number(row._itemId))
  const conditions = row.conditions || []
  if (!conditions.length) return false
  const results = conditions.map((c) => (valuesForType(c.type) || []).includes(c.name))
  return row.match === 'all' ? results.every(Boolean) : results.some(Boolean)
}
