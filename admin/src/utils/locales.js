/** 运营台默认露出的语种。更多语言走 locale_*，暂不展示。 */

export const PRODUCT_LANGS = [
  { code: 'en', label: 'English', short: '英' },
  { code: 'es', label: 'Español', short: '西' },
  { code: 'pt', label: 'Português', short: '葡' },
]

const LANG_NAMES = {
  en: '英语',
  es: '西语',
  pt: '葡语',
  zh: '中文',
}

export function langName(code) {
  return LANG_NAMES[code] || code
}

export function formatMissingLangs(codes) {
  return (codes || []).map((code) => langName(code)).filter(Boolean).join('、')
}

export function translationStatusView(row) {
  const status = row?.translation_status
  if (status === 'complete') return { type: 'success', label: '齐全' }
  if (status === 'incomplete') {
    const missing = formatMissingLangs(row.missing_langs)
    return { type: 'warning', label: missing ? `缺${missing}` : '非三语齐全' }
  }
  const es = String(row?.name_es || row?.label_es || row?.content_es || '').trim()
  const pt = String(row?.name_pt || row?.label_pt || row?.content_pt || '').trim()
  if (row && (es || pt || row?.name || row?.content || row?.name_en)) {
    if (es && pt) return { type: 'success', label: '齐全' }
    const missing = [es ? '' : '西语', pt ? '' : '葡语'].filter(Boolean).join('、')
    return { type: 'warning', label: `缺${missing}` }
  }
  return null
}

/** 列表切语言：缺译文时主文案为「未翻译」，英文放在下面。 */
export function localeCell(row, lang, keys = { en: 'content', es: 'content_es', pt: 'content_pt' }) {
  const english = String(row?.[keys.en] || row?.name || row?.label || '').trim()
  if (!lang || lang === 'en') return { primary: english || '—', missing: false, original: '' }
  const value = String(row?.[keys[lang]] || '').trim()
  if (!value) return { primary: '未翻译', missing: true, original: english }
  return { primary: value, missing: false, original: english }
}

/** App 展示名：目标语为空时回落英文。 */
export function localizedName(row, lang, englishKey = 'name_en') {
  if (!row) return ''
  const english = String(row[englishKey] || row.name || row.name_en || '').trim()
  if (lang === 'es') return String(row.name_es || '').trim() || english
  if (lang === 'pt') return String(row.name_pt || '').trim() || english
  return english
}

export function localeNamePayload(form) {
  return {
    name_es: String(form?.name_es || '').trim(),
    name_pt: String(form?.name_pt || '').trim(),
  }
}

export function normalizeImportErrors(errors) {
  if (!errors) return []
  const list = Array.isArray(errors) ? errors : [errors]
  return list.map((item, index) => {
    if (typeof item === 'string') return { key: index, row: '', column: '', message: item }
    const row = item?.row ?? item?.line ?? item?.row_number ?? item?.index ?? ''
    const column = item?.column ?? item?.col ?? item?.field ?? ''
    const message = item?.message || item?.msg || item?.error || item?.detail || JSON.stringify(item)
    return { key: index, row, column, message }
  })
}
