<!--
  App 用户：搜索/查看详情、编辑资料与启停状态。
-->
<template>
  <div>
    <div class="container">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="systemLang"
        v-model:platform="platform"
        @change="load(1)"
      />
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索用户名/邮箱/设备ID/称呼"
          style="width: 260px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="status" clearable placeholder="状态" style="width: 110px" @change="load(1)">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="vipLevel" clearable placeholder="会员" style="width: 120px" @change="load(1)">
          <el-option v-for="(zh, val) in VIP_LEVEL_ZH" :key="val" :label="zh" :value="val" />
        </el-select>
        <el-select
          v-model="country"
          clearable
          filterable
          placeholder="国家"
          style="width: 160px"
          @change="load(1)"
        >
          <el-option
            v-for="c in COUNTRY_OPTIONS.filter((x) => x.value !== 'GLOBAL')"
            :key="c.value"
            :label="c.label"
            :value="c.value"
          />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">App 用户</div>
      </div>

      <el-table :data="rows" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column prop="display_name" label="称呼" width="120" />
        <el-table-column prop="device_id" label="设备ID" width="220" />
        <el-table-column label="登录" width="100">
          <template #default="{ row }">{{ labelZh(LOGIN_TYPE_ZH, row.login_type) }}</template>
        </el-table-column>
        <el-table-column label="会员" width="120">
          <template #default="{ row }">
            <el-tag :type="row.vip_level === 'free' ? 'info' : 'warning'" size="small">
              {{ labelZh(VIP_LEVEL_ZH, row.vip_level) }}{{ row.is_trial ? '（试用）' : '' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="free_quota" label="Free额度" width="96" />
        <el-table-column prop="register_country" label="国家" width="72" />
        <el-table-column prop="app_key" label="App" width="88">
          <template #default="{ row }">{{ row.app_key || '—' }}</template>
        </el-table-column>
        <el-table-column prop="system_lang" label="语言" width="72" />
        <el-table-column prop="platform" label="设备" width="88">
          <template #default="{ row }">{{ row.platform || '—' }}</template>
        </el-table-column>
        <el-table-column label="图标" width="120">
          <template #default="{ row }">{{ row.selected_icon_key || '—' }}</template>
        </el-table-column>
        <el-table-column label="Prefs" width="96">
          <template #default="{ row }">{{ prefsLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="goAffirmations(row)">肯定语</el-button>
            <el-button link type="primary" @click="goCollections(row)">收藏</el-button>
            <el-button link :type="row.status === 1 ? 'danger' : 'success'" @click="onToggle(row)">
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

    <el-dialog v-model="visible" title="编辑 App 用户" width="640px" destroy-on-close>
      <el-form label-width="130px">
        <el-form-item label="ID">{{ form.id }}</el-form-item>
        <el-form-item label="设备ID">{{ form.device_id || '-' }}</el-form-item>
        <el-form-item label="App">{{ form.app_key || '—' }}</el-form-item>
        <el-form-item label="语言">{{ form.system_lang || '—' }}</el-form-item>
        <el-form-item label="设备">{{ form.platform || '—' }}</el-form-item>
        <el-form-item label="称呼"><el-input v-model="form.display_name" /></el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="form.vip_level" style="width: 100%">
            <el-option label="Free" value="free" />
            <el-option label="VIP" value="vip" />
            <el-option label="Plus VIP" value="plus_vip" />
          </el-select>
        </el-form-item>
        <el-form-item label="试用">
          <el-switch v-model="form.is_trial" />
        </el-form-item>
        <el-form-item label="VIP 到期">
          <el-date-picker
            v-model="form.vip_expire_at"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss[Z]"
            placeholder="UTC"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="Free 额度">
          <el-input-number v-model="form.free_quota" :min="0" />
        </el-form-item>
        <el-form-item label="VIP 日剩余">
          <el-input-number v-model="form.vip_daily_remaining" :min="0" />
        </el-form-item>
        <el-form-item label="营销订阅">
          <el-switch v-model="form.marketing_opt_in" />
        </el-form-item>
        <el-form-item label="App 图标">
          <el-tag v-if="form.selected_icon_key" type="info" size="small">{{ form.selected_icon_key }}</el-tag>
          <span v-else>—</span>
        </el-form-item>
        <el-form-item label="扩展答案（问卷）">
          <el-input
            type="textarea"
            :rows="6"
            readonly
            :model-value="jsonPretty(form.profile_answers)"
          />
        </el-form-item>
        <el-form-item label="提醒偏好">
          <el-input
            type="textarea"
            :rows="4"
            readonly
            :model-value="jsonPretty(form.reminder_prefs)"
          />
        </el-form-item>
        <el-form-item label="小组件偏好">
          <el-input
            type="textarea"
            :rows="5"
            readonly
            :model-value="jsonPretty(form.widget_prefs)"
          />
        </el-form-item>
        <el-form-item label="祷告闹钟">
          <el-input
            type="textarea"
            :rows="3"
            readonly
            :model-value="jsonPretty(form.alarm_prefs)"
          />
        </el-form-item>
        <el-form-item label="祷告锁">
          <el-input
            type="textarea"
            :rows="4"
            readonly
            :model-value="jsonPretty(form.prayer_lock_prefs)"
          />
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
 * App 用户管理：筛选 VIP/状态/国家；详情可改额度、会员到期、营销开关。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAppUsers, fetchAppUserDetail, saveAppUser, toggleAppUserStatus } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'
import { labelZh, LOGIN_TYPE_ZH, VIP_LEVEL_ZH, COUNTRY_OPTIONS } from '../utils/enumZh'  

const router = useRouter()

const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const saving = ref(false)
const form = ref({})
const q = ref('')
const status = ref(null)
const vipLevel = ref(null)
const country = ref('')
const appKey = ref('')
const systemLang = ref('')
const platform = ref('')

/** 分页查询 App 用户列表 */
async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = {
      currentPage: page.value,
      pageSize: 20,
      ...browseScopeParams({
        appKey: appKey.value,
        language: systemLang.value,
        platform: platform.value,
      }),
    }
    if (params.language) {
      params.system_lang = params.language
      delete params.language
    }
    if (q.value) params.q = q.value
    if (status.value === 0 || status.value === 1) params.status = status.value
    if (vipLevel.value) params.vip_level = vipLevel.value
    if (country.value) params.register_country = country.value
    const res = await fetchAppUsers(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 清空筛选回到第 1 页 */
function onReset() {
  q.value = ''
  status.value = null
  vipLevel.value = null
  country.value = ''
  appKey.value = ''
  systemLang.value = ''
  platform.value = ''
  load(1)
}

/** 拉取用户详情打开编辑（含 free_quota / vip_daily_remaining） */
async function openEdit(row) {
  try {
    const res = await fetchAppUserDetail(row.id)
    const detail = res.results || row
    form.value = {
      ...detail,
      free_quota: detail.free_quota ?? 0,
      vip_daily_remaining: detail.vip_daily_remaining ?? 0,
    }
    visible.value = true
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败')
  }
}

/** 保存运营可改字段（展示名、状态、VIP、额度等） */
async function save() {
  saving.value = true
  try {
    await saveAppUser({
      id: form.value.id,
      display_name: form.value.display_name,
      status: form.value.status,
      vip_level: form.value.vip_level,
      is_trial: form.value.is_trial,
      vip_expire_at: form.value.vip_expire_at || null,
      free_quota: form.value.free_quota,
      vip_daily_remaining: form.value.vip_daily_remaining,
      marketing_opt_in: form.value.marketing_opt_in,
    })
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/** 启用/禁用 App 用户 */
async function onToggle(row) {
  const action = row.status === 1 ? '禁用' : '启用'
  await ElMessageBox.confirm(`确认${action}该用户？`, '提示', { type: 'warning' })
  await toggleAppUserStatus(row.id)
  ElMessage.success(`已${action}`)
  load()
}

function goAffirmations(row) {
  router.push({ path: '/user-affirmations', query: { user_id: String(row.id) } })
}

function goCollections(row) {
  const query = { user_id: String(row.id) }
  if (row.app_key) query.app_key = row.app_key
  // Manna 用户默认看 Manna 收藏；Selah 看语录夹
  query.kind = row.app_key === 'manna' ? 'favorite' : 'folder'
  router.push({ path: '/user-collections', query })
}

function jsonPretty(val) {
  try {
    return JSON.stringify(val ?? {}, null, 2)
  } catch (e) {
    return String(val ?? '')
  }
}

/** 列表单行摘要：闹钟/祷告锁是否开启 */
function prefsLabel(row) {
  const parts = []
  if (row?.alarm_prefs?.enabled) parts.push('闹钟')
  if (row?.prayer_lock_prefs?.enabled) parts.push('锁')
  return parts.length ? parts.join('·') : '—'
}

onMounted(() => load(1))
</script>

