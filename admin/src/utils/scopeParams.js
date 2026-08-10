/**
 * 内容库浏览筛参：有值才带维；空=省略 → 后端该维不过滤（看全部）。
 * 配置/占比写入仍用空串精确全局行（见各页 scope()）。
 */
import { APP_KEYS } from './enumZh'

export function browseScopeParams({ appKey, language, platform } = {}) {
  const p = {}
  if (appKey) p.app_key = appKey
  if (language) p.language = language
  if (platform) p.platform = platform
  return p
}

/**
 * 新建内容默认 App：有筛选用筛选；否则落到首个 APP_KEYS，避免误写空维（全局串品牌）。
 */
export function defaultCreateAppKey(filterAppKey = '') {
  const f = (filterAppKey || '').trim()
  if (f) return f
  return (APP_KEYS && APP_KEYS[0]) || 'selah'
}

/** 内容表单空 App 选项文案（仍可选，后端新建会拒空维） */
export const EMPTY_APP_OPTION_LABEL = '全局（两 App 可见）'
