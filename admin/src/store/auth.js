/**
 * 运营后台登录态：token/角色/权限读写 localStorage，供路由守卫与菜单过滤使用。
 *
 * localStorage 键约定（与 Login / API 拦截器 / 路由守卫共用）：
 * - admin_token      : 请求头 token，登录凭证
 * - admin_name       : 展示用用户名
 * - admin_user_id    : 数字用户 id（字符串存储）
 * - admin_role       : 角色名（如 admin / editor）
 * - admin_permissions: JSON 数组字符串，权限码如 ["ops","content"]
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 安全解析 admin_permissions；损坏或空则返回 [] */
function readPerms() {
  try {
    const raw = localStorage.getItem('admin_permissions')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useAuthStore = defineStore('auth', () => {
  const permissions = ref(readPerms())
  const role = ref(localStorage.getItem('admin_role') || '')
  const username = ref(localStorage.getItem('admin_name') || '')
  const userId = ref(Number(localStorage.getItem('admin_user_id') || 0))

  /**
   * 登录成功后写入会话：同步 localStorage + 内存 ref。
   * 各字段可选；仅传入的字段会更新（便于局部刷新）。
   */
  function setSession({ token, username: name, user_id, role: r, permissions: perms }) {
    if (token) localStorage.setItem('admin_token', token)
    if (name != null) {
      localStorage.setItem('admin_name', name)
      username.value = name
    }
    if (user_id != null) {
      localStorage.setItem('admin_user_id', String(user_id))
      userId.value = Number(user_id)
    }
    if (r != null) {
      localStorage.setItem('admin_role', r)
      role.value = r
    }
    if (perms != null) {
      localStorage.setItem('admin_permissions', JSON.stringify(perms))
      permissions.value = [...perms]
    }
  }

  /** 退出登录：清除全部 admin_* 键，并重置内存态 */
  function clearSession() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    localStorage.removeItem('admin_user_id')
    localStorage.removeItem('admin_role')
    localStorage.removeItem('admin_permissions')
    permissions.value = []
    role.value = ''
    username.value = ''
    userId.value = 0
  }

  /** 从 localStorage 重新灌入内存（路由守卫在刷新后调用） */
  function hydrateFromStorage() {
    permissions.value = readPerms()
    role.value = localStorage.getItem('admin_role') || ''
    username.value = localStorage.getItem('admin_name') || ''
    userId.value = Number(localStorage.getItem('admin_user_id') || 0)
  }

  /** 判断当前账号是否拥有指定权限码 */
  function hasPerm(code) {
    return permissions.value.includes(code)
  }

  return { permissions, role, username, userId, setSession, clearSession, hydrateFromStorage, hasPerm }
})
