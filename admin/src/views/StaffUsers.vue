<!--
  后台员工：运营账号 CRUD、角色分配与启停。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索用户名/邮箱"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="role" clearable placeholder="角色" style="width: 140px" @change="load(1)">
          <el-option label="运营" value="operator" />
          <el-option label="远程push" value="push_ops" />
          <el-option label="管理员" value="admin" />
          <el-option label="超级管理员" value="super_admin" />
        </el-select>
        <el-select v-model="status" clearable placeholder="状态" style="width: 110px" @change="load(1)">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="appKey" clearable filterable placeholder="App" style="width: 110px" @change="load(1)">
          <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">后台用户</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" :icon="CirclePlusFilled" @click="openEdit()">新建</el-button>
        </div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="email" label="邮箱" min-width="160" />
        <el-table-column prop="role_label" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTag(row.role)" size="small">{{ row.role_label || row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="App" min-width="160">
          <template #default="{ row }">
            <template v-if="row.app_keys && row.app_keys.length">
              <el-tag
                v-for="a in row.app_keys"
                :key="a"
                size="small"
                class="app-tag"
                :type="a === 'manna' ? 'warning' : 'primary'"
              >{{ a }}</el-tag>
            </template>
            <span v-else class="sub">全部</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 1 ? 'danger' : 'success'"
              :disabled="row.id === myId"
              @click="onToggle(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑后台用户' : '新建后台用户'" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item :label="form.id ? '新密码' : '密码'" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空则不修改' : ''" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" style="width: 100%" :disabled="form.id === myId">
            <el-option label="运营" value="operator" />
            <el-option label="远程push" value="push_ops" />
            <el-option label="管理员" value="admin" />
            <el-option v-if="myRole === 'super_admin'" label="超级管理员" value="super_admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="App">
          <el-select
            v-model="form.app_keys"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            placeholder="可多选；不选=全部 App"
            style="width: 100%"
          >
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status" :disabled="form.id === myId">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 后台员工账号：角色 operator/admin/super_admin；新建必填密码，编辑密码可选。
 * App 多选写入 app_keys；空=全部 App。
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchStaffUsers, saveStaffUser, toggleStaffUserStatus } from '../api'
import { useAuthStore } from '../store/auth'
import { APP_KEYS } from '../utils/enumZh'

const auth = useAuthStore()
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const saving = ref(false)
const form = ref({})
const q = ref('')
const role = ref(null)
const status = ref(null)
const appKey = ref(null)
const myId = computed(() => auth.userId)
const myRole = computed(() => auth.role)

/** 角色 Tag 颜色：super_admin 红 / admin 橙 / push_ops 蓝 / 其余灰 */
function roleTag(r) {
  if (r === 'super_admin') return 'danger'
  if (r === 'admin') return 'warning'
  if (r === 'push_ops') return ''
  return 'info'
}

/** 分页查询后台员工 */
async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = { currentPage: page.value, pageSize: 20 }
    if (q.value) params.q = q.value
    if (role.value) params.role = role.value
    if (status.value === 0 || status.value === 1) params.status = status.value
    if (appKey.value) params.app_key = appKey.value
    const res = await fetchStaffUsers(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 清空筛选 */
function onReset() {
  q.value = ''
  role.value = null
  status.value = null
  appKey.value = null
  load(1)
}

/** 打开编辑；新建默认 operator，App 默认全选当前产品线 */
function openEdit(row) {
  form.value = row
    ? {
        id: row.id,
        username: row.username,
        email: row.email || '',
        role: row.role,
        status: row.status,
        password: '',
        app_keys: Array.isArray(row.app_keys) ? [...row.app_keys] : [],
      }
    : {
        username: '',
        email: '',
        role: 'operator',
        status: 1,
        password: '',
        app_keys: [...APP_KEYS],
      }
  visible.value = true
}

/** 保存员工；新建必须有密码，编辑仅在填写时改密 */
async function save() {
  if (!form.value.username) {
    ElMessage.warning('请填写用户名')
    return
  }
  if (!form.value.id && !form.value.password) {
    ElMessage.warning('请填写密码')
    return
  }
  saving.value = true
  try {
    const payload = {
      username: form.value.username,
      email: form.value.email || '',
      role: form.value.role,
      status: form.value.status,
      app_keys: Array.isArray(form.value.app_keys) ? form.value.app_keys : [],
    }
    if (form.value.id) payload.id = form.value.id
    if (form.value.password) payload.password = form.value.password
    await saveStaffUser(payload)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/** 启用/禁用后台账号 */
async function onToggle(row) {
  const action = row.status === 1 ? '禁用' : '启用'
  await ElMessageBox.confirm(`确认${action}账号「${row.username}」？`, '提示', { type: 'warning' })
  await toggleStaffUserStatus(row.id)
  ElMessage.success(`已${action}`)
  load()
}

onMounted(() => load(1))
</script>

<style scoped>
.app-tag { margin-right: 4px; }
.sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>

