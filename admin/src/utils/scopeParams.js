/**
 * 内容库浏览筛参：有值才带维；空=省略 → 后端该维不过滤（看全部）。
 * 配置/占比写入仍用空串精确全局行（见各页 scope()）。
 */
import { APP_KEYS } from './enumZh'
import { getAdminProduct } from './productContext'

export function browseScopeParams({ appKey, language, platform } = {}) {
  const p = {}
  p.app_key = getAdminProduct() || appKey || 'selah'
  if (language) p.language = language
  if (platform) p.platform = platform
  return p
}

/**
 * 新建内容默认 App：固定为顶栏当前产品，禁止空维/跨产品。
 */
export function defaultCreateAppKey(filterAppKey = '', fallback = '') {
  const current = getAdminProduct()
  if (current) return current
  const f = (filterAppKey || '').trim()
  if (f) return f
  const fb = (fallback || '').trim()
  if (fb) return fb
  return (APP_KEYS && APP_KEYS[0]) || 'selah'
}

/** 内容表单空 App 选项文案（仍可选，后端新建会拒空维；内容空维不再对两 App 可见） */
export const EMPTY_APP_OPTION_LABEL = '空维（内容不可见；仅配置可回退）'

/** 内容表 App 列：空维不是「全部可见」 */
export function contentAppKeyLabel(v) {
  return v || '空维'
}
