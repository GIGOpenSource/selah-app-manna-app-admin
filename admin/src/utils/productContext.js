/**
 * 当前管理端产品上下文。
 * VITE_ADMIN_PRODUCT=selah|manna 为默认值；运营可在顶栏切换，写入 localStorage。
 * 页面内配置维度不再选手动 App，一律跟顶栏走。
 */
import { ref } from 'vue'

export const APP_SWITCH_KEYS = ['selah', 'manna']

export const APP_SWITCH_OPTIONS = [
  { value: 'selah', label: 'Selah' },
  { value: 'manna', label: 'Manna' },
]

export const DEFAULT_ADMIN_PRODUCT = String(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ADMIN_PRODUCT) || 'selah',
).trim().toLowerCase() || 'selah'

const STORAGE_KEY = 'admin_current_app'

function normalizeAppKey(v) {
  const key = String(v || '').trim().toLowerCase()
  return APP_SWITCH_KEYS.includes(key) ? key : DEFAULT_ADMIN_PRODUCT
}

function readStoredAppKey() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_ADMIN_PRODUCT
    return normalizeAppKey(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_ADMIN_PRODUCT
  }
}

/** 当前选中的 App（顶栏切换；请求与新建都读这个） */
export const currentAppKey = ref(readStoredAppKey())

/** 兼容旧引用：构建默认产品，不等于顶栏当前值 */
export const ADMIN_PRODUCT = DEFAULT_ADMIN_PRODUCT

export function getAdminProduct() {
  return currentAppKey.value || DEFAULT_ADMIN_PRODUCT
}

export function appLabel(key = getAdminProduct()) {
  const hit = APP_SWITCH_OPTIONS.find((o) => o.value === key)
  return hit ? hit.label : key
}

export function setCurrentAppKey(v) {
  const next = normalizeAppKey(v)
  currentAppKey.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore quota / private mode */
  }
  return next
}

/** 账号可管 App 变化时，把当前选择限制在允许范围内；空列表=全部 */
export function syncAppKeyToAllowed(allowed) {
  const list = Array.isArray(allowed)
    ? allowed.map((k) => String(k).trim().toLowerCase()).filter((k) => APP_SWITCH_KEYS.includes(k))
    : []
  const usable = list.length ? list : APP_SWITCH_KEYS
  if (!usable.includes(currentAppKey.value)) {
    setCurrentAppKey(usable[0])
  }
  return getAdminProduct()
}

export function isSelahAdmin() {
  return getAdminProduct() === 'selah'
}

export function isMannaAdmin() {
  return getAdminProduct() === 'manna'
}

/** 普通业务页不再配设备；App 图标等平台能力传 keepPlatform */
export function shouldHidePlatform(keepPlatform = false) {
  if (keepPlatform) return false
  return isSelahAdmin()
}
