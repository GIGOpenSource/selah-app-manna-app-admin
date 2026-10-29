<!--
  运营 PUSH：一次 / 每天 / 每周 / 每月调度、CSV 目标、审核人、系列 pause/resume/end。
  时间字段按 UTC 提交；审核人不可选自己。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索任务名"
          style="width: 200px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="status" clearable placeholder="状态" style="width: 140px" @change="load(1)">
          <el-option
            v-for="(label, key) in PUSH_CAMPAIGN_STATUS_ZH"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-select
          v-model="scheduleModeFilter"
          clearable
          placeholder="周期"
          style="width: 120px"
          @change="load(1)"
        >
          <el-option
            v-for="m in PUSH_SCHEDULE_MODE_OPTIONS"
            :key="m.value"
            :label="m.label"
            :value="m.value"
          />
        </el-select>
        <el-checkbox v-model="onlyMine" style="margin-left: 8px" @change="load(1)">待我审核</el-checkbox>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">运营 PUSH</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" :icon="CirclePlusFilled" @click="openEdit()">新建任务</el-button>
        </div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="任务名称" min-width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="调度" min-width="160">
          <template #default="{ row }">
            <div>{{ row.schedule_label || modeLabel(row.schedule_mode) }}</div>
            <div class="sub" v-if="row.is_recurring && row.series_status">
              <el-tag :type="seriesTag(row.series_status)" size="small">
                {{ seriesLabel(row.series_status) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="下次执行(UTC)" width="170">
          <template #default="{ row }">
            {{ row.next_run_at || row.scheduled_at || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="创建人" width="90" />
        <el-table-column prop="reviewer_name" label="审核人" width="90" />
        <el-table-column label="目标" width="120">
          <template #default="{ row }">
            <div>{{ row.valid_count ?? 0 }} 有效 / {{ row.target_count ?? 0 }}</div>
            <div class="sub">无效 {{ row.invalid_count ?? 0 }} · 重复 {{ row.duplicate_count ?? 0 }}</div>
          </template>
        </el-table-column>
        <el-table-column label="发送" width="120">
          <template #default="{ row }">
            <div>成功 {{ row.success_count ?? 0 }}</div>
            <div class="sub">
              失败 {{ row.fail_count ?? 0 }}
              <template v-if="row.is_recurring"> · 第 {{ row.occurrence_count ?? 0 }} 轮</template>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-if="canEdit(row)" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'draft'" link type="warning" @click="onSubmit(row)">提交审核</el-button>
            <el-button v-if="canReview(row)" link type="success" @click="openReview(row)">审核</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>

    <!-- 创建 / 编辑 -->
    <el-dialog
      v-model="editVisible"
      :title="form.id ? '编辑运营 PUSH' : '新建运营 PUSH'"
      width="760px"
      destroy-on-close
      top="4vh"
    >
      <el-form label-width="120px">
        <el-form-item label="任务名称" required>
          <el-input v-model="form.name" maxlength="120" show-word-limit />
        </el-form-item>

        <el-form-item label="发送周期" required>
          <el-radio-group v-model="form.schedule_mode">
            <el-radio-button
              v-for="m in PUSH_SCHEDULE_MODE_OPTIONS"
              :key="m.value"
              :label="m.value"
            >{{ m.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.schedule_mode === 'once'">
          <el-form-item label="发送时间" required>
            <el-date-picker
              v-model="form.scheduledLocal"
              type="datetime"
              placeholder="本地时间，提交转为 UTC"
              style="width: 100%"
            />
            <!-- <div class="sub tip">保存时转为 UTC ISO（如 2026-04-01T12:00:00Z）</div> -->
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="UTC 时刻" required>
            <el-time-picker
              v-model="form.scheduleTimeDate"
              value-format="HH:mm:ss"
              format="HH:mm:ss"
              placeholder="如 12:00:00 UTC"
              style="width: 100%"
            />
            <div class="sub tip">按 UTC 时分秒提交 schedule_time</div>
          </el-form-item>
          <el-form-item v-if="form.schedule_mode === 'weekly'" label="星期" required>
            <el-checkbox-group v-model="form.weekdays">
              <el-checkbox
                v-for="d in PUSH_WEEKDAY_OPTIONS"
                :key="d.value"
                :label="d.value"
              >{{ d.label }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item v-if="form.schedule_mode === 'monthly'" label="每月几号" required>
            <el-input-number v-model="form.day_of_month" :min="1" :max="31" />
            <div class="sub tip">该月无此日（如 31）则跳到下个有该日的月</div>
          </el-form-item>
          <el-form-item label="系列开始">
            <el-date-picker
              v-model="form.seriesStartLocal"
              type="datetime"
              clearable
              placeholder="可选，默认从现在起算"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="系列结束">
            <el-date-picker
              v-model="form.seriesEndLocal"
              type="datetime"
              clearable
              placeholder="可选，空=不限"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="最多执行">
            <el-input-number v-model="form.max_occurrences" :min="1" :controls="true" />
            <el-button link type="primary" style="margin-left: 8px" @click="form.max_occurrences = null">不限</el-button>
          </el-form-item>
        </template>

        <el-form-item label="审核人" required>
          <el-select
            v-model="form.reviewer_id"
            filterable
            :loading="reviewerLoading"
            style="width: 100%"
            placeholder="选择角色为「远程push」的后台用户（不可选自己）"
          >
            <el-option
              v-for="r in reviewerOptions"
              :key="r.id"
              :label="`${r.username || r.display_name || '用户'} (#${r.id})`"
              :value="r.id"
              :disabled="r.id === myId"
            />
          </el-select>
          <div class="sub tip">审核人来自后台用户角色「远程push」，不可选自己</div>
        </el-form-item>
        <el-form-item label="目标用户" required>
          <div class="user-picker" @click="openUserPicker">
            <div v-if="selectedUsers.length" class="user-picker-tags" @click.stop>
              <el-tag
                v-for="u in selectedUsers"
                :key="u.id"
                closable
                size="small"
                class="user-tag"
                @close="removeSelectedUser(u.id)"
              >
                {{ u.display_name || u.device_id || `#${u.id}` }}
                <span class="user-tag-id">#{{ u.id }}</span>
              </el-tag>
            </div>
            <span v-else class="user-picker-placeholder">从 App 用户中选择，最多 1000 人</span>
            <el-button type="primary" link class="user-picker-btn" @click.stop="openUserPicker">
              选择用户
            </el-button>
          </div>
          <div class="sub tip">已选 {{ selectedUsers.length }} 人 · 数据来自「用户管理 → App 用户」</div>
          <div v-if="uploadStats" class="upload-stats">
            上传 {{ uploadStats.upload_total }} · 有效 {{ uploadStats.valid_count }} ·
            无效 {{ uploadStats.invalid_count }} · 重复 {{ uploadStats.duplicate_count }} ·
            目标 {{ uploadStats.target_count }}
          </div>
        </el-form-item>
        <el-form-item label="多语文案" required>
          <el-tabs v-model="copyTab" type="card" editable @edit="onCopyTabEdit">
            <el-tab-pane
              v-for="(c, idx) in form.copies"
              :key="`${c.lang}-${idx}`"
              :label="c.lang || `语言${idx + 1}`"
              :name="String(idx)"
            >
              <div class="copy-fields">
                <el-form-item label="语言" label-width="60px">
                  <el-select v-model="c.lang" filterable style="width: 100%">
                    <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="标题" label-width="60px">
                  <el-input v-model="c.title" maxlength="120" />
                </el-form-item>
                <el-form-item label="正文" label-width="60px">
                  <el-input v-model="c.body" type="textarea" :rows="3" maxlength="500" />
                </el-form-item>
              </div>
            </el-tab-pane>
          </el-tabs>
          <!-- <div class="sub tip">建议至少填写 en；保存后展示 schedule_label / next_run_at</div> -->
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button :loading="saving" @click="saveCampaign(false)">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="saveCampaign(true)">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 详情 / 审核 / 系列控制 -->
    <el-drawer v-model="detailVisible" title="任务详情" size="680px" destroy-on-close>
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="名称" :span="2">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="调度" :span="2">
            {{ detail.schedule_label || modeLabel(detail.schedule_mode) }}
            <el-tag
              v-if="detail.is_recurring && detail.series_status"
              :type="seriesTag(detail.series_status)"
              size="small"
              style="margin-left: 8px"
            >
              {{ seriesLabel(detail.series_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="下次执行">{{ detail.next_run_at || '—' }}</el-descriptions-item>
          <el-descriptions-item label="上次执行">{{ detail.last_run_at || '—' }}</el-descriptions-item>
          <el-descriptions-item label="计划参考">{{ detail.scheduled_at || '—' }}</el-descriptions-item>
          <el-descriptions-item label="实际发送">{{ detail.actual_sent_at || '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.is_recurring" label="已执行轮次">
            {{ detail.occurrence_count ?? 0 }}
            <template v-if="detail.max_occurrences"> / {{ detail.max_occurrences }}</template>
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.is_recurring" label="系列起止">
            {{ detail.series_start_at || '—' }} ~ {{ detail.series_end_at || '不限' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">{{ detail.creator_name }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ detail.reviewer_name }}</el-descriptions-item>
          <el-descriptions-item label="目标/有效">
            {{ detail.target_count }} / {{ detail.valid_count }}
          </el-descriptions-item>
          <el-descriptions-item label="成功/失败">
            {{ detail.success_count }} / {{ detail.fail_count }}
          </el-descriptions-item>
          <el-descriptions-item label="点击/进端">
            {{ detail.click_count }} / {{ detail.open_count }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.reject_reason" label="驳回原因" :span="2">
            {{ detail.reject_reason }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="canControlSeries(detail)" class="review-actions">
          <el-button
            v-if="detail.series_status === 'active'"
            type="warning"
            :loading="saving"
            @click="onSeries('pause')"
          >暂停系列</el-button>
          <el-button
            v-if="detail.series_status === 'paused'"
            type="success"
            :loading="saving"
            @click="onSeries('resume')"
          >恢复系列</el-button>
          <el-button
            v-if="detail.series_status === 'active' || detail.series_status === 'paused'"
            type="danger"
            :loading="saving"
            @click="onSeries('end')"
          >结束系列</el-button>
        </div>

        <div class="section-title">文案</div>
        <el-table :data="detail.copies || []" size="small">
          <el-table-column prop="lang" label="语言" width="80" />
          <el-table-column prop="title" label="标题" min-width="120" />
          <el-table-column prop="body" label="正文" min-width="180" show-overflow-tooltip />
        </el-table>

        <div class="section-title">
          目标用户
          <el-select
            v-model="targetStatus"
            clearable
            placeholder="状态"
            size="small"
            style="width: 120px; margin-left: 12px"
            @change="loadTargets(1)"
          >
            <el-option
              v-for="(label, key) in PUSH_TARGET_STATUS_ZH"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
          <el-button
            v-if="detail.id"
            link
            type="primary"
            style="margin-left: auto"
            @click="goCampaignLogs(detail.id)"
          >查看发送记录</el-button>
        </div>
        <el-table :data="targets" v-loading="targetsLoading" size="small">
          <el-table-column prop="user_id" label="用户 ID" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">{{ labelZh(PUSH_TARGET_STATUS_ZH, row.status) }}</template>
          </el-table-column>
          <el-table-column prop="error" label="错误" min-width="140" show-overflow-tooltip />
          <el-table-column prop="sent_at" label="发送时间" width="170" />
        </el-table>
        <el-pagination
          class="pagination"
          small
          layout="total, prev, pager, next"
          :total="targetsTotal"
          :page-size="10"
          v-model:current-page="targetsPage"
          @current-change="loadTargets"
        />

        <div v-if="canReview(detail)" class="review-actions">
          <el-button type="success" @click="doReview(true)">通过</el-button>
          <el-button type="danger" @click="openReject">驳回</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="rejectVisible" title="驳回原因" width="420px">
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="必填" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="saving" @click="doReview(false)">确认驳回</el-button>
      </template>
    </el-dialog>

    <!-- 从 App 用户选择目标 -->
    <el-dialog
      v-model="userPickerVisible"
      title="选择 App 用户"
      width="820px"
      destroy-on-close
      top="6vh"
      append-to-body
    >
      <div class="pro-search" style="margin-bottom: 12px">
        <el-input
          v-model="userPickerQ"
          clearable
          placeholder="搜索称呼 / 设备ID / 邮箱"
          style="width: 260px"
          @keyup.enter="loadUserPicker(1)"
        />
        <el-select v-model="userPickerStatus" clearable placeholder="状态" style="width: 110px" @change="loadUserPicker(1)">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="loadUserPicker(1)">查询</el-button>
        <span class="sub" style="margin-left: 8px">当前 App：{{ appKey() }} · 已勾选 {{ userPickerDraftIds.length }}</span>
      </div>
      <el-table
        ref="userPickerTableRef"
        :data="userPickerRows"
        v-loading="userPickerLoading"
        row-key="id"
        size="small"
        max-height="420"
        @selection-change="onUserPickerSelection"
      >
        <el-table-column type="selection" width="48" :reserve-selection="true" />
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="display_name" label="称呼" min-width="120" />
        <el-table-column prop="device_id" label="设备ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="system_lang" label="语言" width="80" />
        <el-table-column prop="platform" label="设备" width="90" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        small
        background
        layout="total, prev, pager, next"
        :total="userPickerTotal"
        :page-size="userPickerPageSize"
        v-model:current-page="userPickerPage"
        @current-change="loadUserPicker"
      />
      <template #footer>
        <el-button @click="userPickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUserPicker">确定（{{ userPickerDraftIds.length }}）</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchPushCampaigns,
  savePushCampaign,
  submitPushCampaign,
  reviewPushCampaign,
  controlPushCampaignSeries,
  fetchPushCampaignTargets,
  fetchStaffUsers,
  fetchAppUsers,
} from '../api'
import { useAuthStore } from '../store/auth'
import { getAdminProduct } from '../utils/productContext'
import {
  LANG_OPTIONS,
  PUSH_CAMPAIGN_STATUS_ZH,
  PUSH_CAMPAIGN_STATUS_TAG,
  PUSH_SCHEDULE_MODE_OPTIONS,
  PUSH_SCHEDULE_MODE_ZH,
  PUSH_SERIES_STATUS_ZH,
  PUSH_SERIES_STATUS_TAG,
  PUSH_WEEKDAY_OPTIONS,
  PUSH_TARGET_STATUS_ZH,
  labelZh,
} from '../utils/enumZh'

const router = useRouter()
const auth = useAuthStore()
const myId = computed(() => Number(auth.userId || 0))

const rows = ref([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const q = ref('')
const status = ref('')
const scheduleModeFilter = ref('')
const onlyMine = ref(false)

const editVisible = ref(false)
const form = ref(emptyForm())
const copyTab = ref('0')
const uploadStats = ref(null)
const reviewerOptions = ref([])
const reviewerLoading = ref(false)
const selectedUsers = ref([])

const userPickerVisible = ref(false)
const userPickerQ = ref('')
const userPickerStatus = ref(1)
const userPickerRows = ref([])
const userPickerPage = ref(1)
const userPickerPageSize = 20
const userPickerTotal = ref(0)
const userPickerLoading = ref(false)
const userPickerTableRef = ref(null)
/** 弹窗内勾选草稿：id → 用户摘要 */
const userPickerDraftMap = ref(new Map())
const userPickerDraftIds = computed(() => [...userPickerDraftMap.value.keys()])
const syncingUserSelection = ref(false)

const detailVisible = ref(false)
const detail = ref(null)
const targets = ref([])
const targetsPage = ref(1)
const targetsTotal = ref(0)
const targetsLoading = ref(false)
const targetStatus = ref('')
const rejectVisible = ref(false)
const rejectReason = ref('')

function emptyForm() {
  return {
    id: null,
    name: '',
    schedule_mode: 'once',
    scheduledLocal: null,
    scheduleTimeDate: null,
    weekdays: [0, 2, 4],
    day_of_month: 1,
    seriesStartLocal: null,
    seriesEndLocal: null,
    max_occurrences: null,
    reviewer_id: null,
    copies: [{ lang: 'en', title: '', body: '' }],
  }
}

function userBrief(u) {
  return {
    id: u.id,
    display_name: u.display_name || '',
    device_id: u.device_id || '',
  }
}

function removeSelectedUser(id) {
  selectedUsers.value = selectedUsers.value.filter((u) => u.id !== id)
}

async function openUserPicker() {
  userPickerDraftMap.value = new Map(selectedUsers.value.map((u) => [u.id, userBrief(u)]))
  userPickerQ.value = ''
  userPickerStatus.value = 1
  userPickerVisible.value = true
  await loadUserPicker(1)
}

async function loadUserPicker(p = userPickerPage.value) {
  userPickerPage.value = p
  userPickerLoading.value = true
  try {
    const params = {
      app_key: appKey(),
      currentPage: userPickerPage.value,
      pageSize: userPickerPageSize,
    }
    if (userPickerQ.value) params.q = userPickerQ.value
    if (userPickerStatus.value !== null && userPickerStatus.value !== '') {
      params.status = userPickerStatus.value
    }
    const res = await fetchAppUsers(params)
    userPickerRows.value = res.results || []
    userPickerTotal.value = res.pagination?.total || userPickerRows.value.length
    await nextTick()
    syncUserPickerSelection()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载 App 用户失败')
  } finally {
    userPickerLoading.value = false
  }
}

function syncUserPickerSelection() {
  const table = userPickerTableRef.value
  if (!table) return
  syncingUserSelection.value = true
  table.clearSelection()
  for (const row of userPickerRows.value) {
    if (userPickerDraftMap.value.has(row.id)) {
      table.toggleRowSelection(row, true)
    }
  }
  syncingUserSelection.value = false
}

function onUserPickerSelection(selection) {
  if (syncingUserSelection.value) return
  const pageIds = new Set(userPickerRows.value.map((r) => r.id))
  for (const id of pageIds) {
    if (![...selection].some((r) => r.id === id)) {
      userPickerDraftMap.value.delete(id)
    }
  }
  for (const row of selection) {
    userPickerDraftMap.value.set(row.id, userBrief(row))
  }
  // 触发 computed 刷新
  userPickerDraftMap.value = new Map(userPickerDraftMap.value)
}

function confirmUserPicker() {
  const list = [...userPickerDraftMap.value.values()]
  if (list.length > 1000) {
    ElMessage.warning('最多选择 1000 个用户')
    return
  }
  selectedUsers.value = list
  userPickerVisible.value = false
}

function appKey() {
  return getAdminProduct() || 'selah'
}

function statusLabel(s) {
  return labelZh(PUSH_CAMPAIGN_STATUS_ZH, s, s)
}
function statusTag(s) {
  return PUSH_CAMPAIGN_STATUS_TAG[s] || 'info'
}
function modeLabel(s) {
  return labelZh(PUSH_SCHEDULE_MODE_ZH, s, s || 'once')
}
function seriesLabel(s) {
  return labelZh(PUSH_SERIES_STATUS_ZH, s, s)
}
function seriesTag(s) {
  return PUSH_SERIES_STATUS_TAG[s] || 'info'
}

function canEdit(row) {
  return row.status === 'draft' || row.status === 'rejected'
}
function canReview(row) {
  return row.status === 'pending_review' && Number(row.reviewer_id) === myId.value
}
function canControlSeries(row) {
  return !!row?.is_recurring && (row.series_status === 'active' || row.series_status === 'paused')
}

function toUtcIso(localVal) {
  if (!localVal) return ''
  const d = localVal instanceof Date ? localVal : new Date(localVal)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** el-time-picker value-format 可能直接给字符串 */
function normalizeScheduleTime(v) {
  if (!v) return ''
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s
    if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`
  }
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function parseTimeToPicker(timeStr) {
  if (!timeStr) return null
  const s = String(timeStr).trim()
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s
  return null
}

/** 审核人 = 后台用户角色 push_ops（远程push），排除自己 */
async function loadReviewerOptions() {
  reviewerLoading.value = true
  try {
    const res = await fetchStaffUsers({
      role: 'push_ops',
      status: 1,
      currentPage: 1,
      pageSize: 200,
    })
    const list = res.results || []
    reviewerOptions.value = list.filter((r) => Number(r.id) !== myId.value)
  } catch {
    reviewerOptions.value = []
  } finally {
    reviewerLoading.value = false
  }
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = {
      app_key: appKey(),
      currentPage: page.value,
      pageSize,
    }
    if (q.value) params.q = q.value
    if (scheduleModeFilter.value) params.schedule_mode = scheduleModeFilter.value
    if (onlyMine.value) {
      params.status = 'pending_review'
    } else if (status.value) {
      params.status = status.value
    }
    const res = await fetchPushCampaigns(params)
    let list = Array.isArray(res.results) ? res.results : []
    if (onlyMine.value) {
      list = list.filter((r) => Number(r.reviewer_id) === myId.value)
    }
    rows.value = list
    total.value = res.pagination?.total || list.length
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  q.value = ''
  status.value = ''
  scheduleModeFilter.value = ''
  onlyMine.value = false
  load(1)
}

function detailToForm(d) {
  const mode = d.schedule_mode || 'once'
  const rule = d.schedule_rule || {}
  return {
    id: d.id,
    name: d.name || '',
    schedule_mode: mode,
    scheduledLocal: d.scheduled_at ? new Date(d.scheduled_at) : null,
    scheduleTimeDate: parseTimeToPicker(d.schedule_time) || parseTimeFromIso(d.scheduled_at),
    weekdays: Array.isArray(rule.weekdays) ? [...rule.weekdays] : [0, 2, 4],
    day_of_month: rule.day_of_month || 1,
    seriesStartLocal: d.series_start_at ? new Date(d.series_start_at) : null,
    seriesEndLocal: d.series_end_at ? new Date(d.series_end_at) : null,
    max_occurrences: d.max_occurrences ?? null,
    reviewer_id: d.reviewer_id || null,
    copies: (d.copies || []).length
      ? d.copies.map((c) => ({ lang: c.lang, title: c.title, body: c.body }))
      : [{ lang: 'en', title: '', body: '' }],
  }
}

function parseTimeFromIso(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

async function openEdit(row) {
  uploadStats.value = null
  selectedUsers.value = []
  await loadReviewerOptions()
  if (row?.id) {
    try {
      const res = await fetchPushCampaigns({ id: row.id, app_key: appKey() })
      const d = res.results && !Array.isArray(res.results) ? res.results : row
      form.value = detailToForm(d)
      await hydrateSelectedUsersFromTargets(d.id)
    } catch {
      form.value = detailToForm(row)
      await hydrateSelectedUsersFromTargets(row.id)
    }
  } else {
    form.value = emptyForm()
  }
  copyTab.value = '0'
  editVisible.value = true
}

/** 编辑草稿时从目标明细回填已选用户（最多取前 1000） */
async function hydrateSelectedUsersFromTargets(campaignId) {
  if (!campaignId) return
  try {
    const res = await fetchPushCampaignTargets({
      campaign_id: campaignId,
      currentPage: 1,
      pageSize: 1000,
    })
    const list = res.results || []
    selectedUsers.value = list.map((t) => ({
      id: t.user_id,
      display_name: t.display_name || '',
      device_id: t.device_id || '',
    }))
  } catch {
    selectedUsers.value = []
  }
}

function onCopyTabEdit(targetName, action) {
  if (action === 'add') {
    form.value.copies.push({ lang: 'zh', title: '', body: '' })
    copyTab.value = String(form.value.copies.length - 1)
  } else if (action === 'remove') {
    const idx = Number(targetName)
    if (form.value.copies.length <= 1) {
      ElMessage.warning('至少保留一种语言')
      return
    }
    form.value.copies.splice(idx, 1)
    copyTab.value = '0'
  }
}

function buildSchedulePayload() {
  const mode = form.value.schedule_mode || 'once'
  const payload = { schedule_mode: mode }
  if (mode === 'once') {
    const scheduled_at = toUtcIso(form.value.scheduledLocal)
    if (!scheduled_at) {
      ElMessage.warning('请选择发送时间')
      return null
    }
    payload.scheduled_at = scheduled_at
    return payload
  }
  const schedule_time = normalizeScheduleTime(form.value.scheduleTimeDate)
  if (!schedule_time) {
    ElMessage.warning('请选择 UTC 时刻')
    return null
  }
  payload.schedule_time = schedule_time
  if (mode === 'weekly') {
    const weekdays = [...(form.value.weekdays || [])].map(Number).filter((n) => n >= 0 && n <= 6)
    if (!weekdays.length) {
      ElMessage.warning('请至少选择一个星期')
      return null
    }
    payload.schedule_rule = { weekdays }
  }
  if (mode === 'monthly') {
    const day = Number(form.value.day_of_month)
    if (!day || day < 1 || day > 31) {
      ElMessage.warning('请填写每月几号（1–31）')
      return null
    }
    payload.schedule_rule = { day_of_month: day }
  }
  const start = toUtcIso(form.value.seriesStartLocal)
  const end = toUtcIso(form.value.seriesEndLocal)
  payload.series_start_at = start || null
  payload.series_end_at = end || null
  payload.max_occurrences = form.value.max_occurrences || null
  return payload
}

async function saveCampaign(submitReview) {
  if (!(form.value.name || '').trim()) {
    ElMessage.warning('请填写任务名称')
    return
  }
  const schedule = buildSchedulePayload()
  if (!schedule) return
  if (!form.value.reviewer_id) {
    ElMessage.warning('请选择审核人')
    return
  }
  if (Number(form.value.reviewer_id) === myId.value) {
    ElMessage.warning('审核人不能是自己')
    return
  }
  const copies = (form.value.copies || []).filter((c) => (c.title || '').trim() && (c.body || '').trim())
  if (!copies.length) {
    ElMessage.warning('请至少填写一组完整文案')
    return
  }
  const userIds = selectedUsers.value.map((u) => u.id).filter(Boolean)
  if (!userIds.length) {
    ElMessage.warning('请选择目标用户')
    return
  }
  if (userIds.length > 1000) {
    ElMessage.warning('最多选择 1000 个用户')
    return
  }
  saving.value = true
  try {
    const body = {
      app_key: appKey(),
      name: form.value.name.trim(),
      ...schedule,
      reviewer_id: form.value.reviewer_id,
      copies,
      user_ids: userIds,
      submit_review: !!submitReview,
    }
    if (form.value.id) body.id = form.value.id
    const res = await savePushCampaign(body)
    const data = res.results || {}
    if (data.upload) uploadStats.value = data.upload
    const bits = []
    if (data.schedule_label) bits.push(data.schedule_label)
    if (data.next_run_at) bits.push(`下次 ${data.next_run_at}`)
    ElMessage.success(submitReview ? '已提交审核' : '已保存草稿')
    if (data.upload) {
      ElMessage.info(
        `上传 ${data.upload.upload_total} · 有效 ${data.upload.valid_count} · 无效 ${data.upload.invalid_count} · 重复 ${data.upload.duplicate_count}`,
      )
    }
    if (bits.length) ElMessage.info(bits.join(' · '))
    editVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onSubmit(row) {
  try {
    await ElMessageBox.confirm(`提交任务「${row.name}」审核？`, '确认', { type: 'info' })
    await submitPushCampaign({ id: row.id })
    ElMessage.success('已提交审核')
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e?.message || e?.msg || '提交失败')
  }
}

async function openDetail(row) {
  detailVisible.value = true
  detail.value = null
  targets.value = []
  targetStatus.value = ''
  targetsPage.value = 1
  try {
    const res = await fetchPushCampaigns({ id: row.id, app_key: appKey() })
    detail.value = res.results && !Array.isArray(res.results) ? res.results : { ...row }
  } catch {
    detail.value = { ...row }
  }
  loadTargets(1)
}

function openReview(row) {
  openDetail(row)
}

function goCampaignLogs(campaignId) {
  detailVisible.value = false
  router.push({ path: '/push-logs', query: { push_type: 'campaign', campaign_id: String(campaignId) } })
}

async function onSeries(action) {
  if (!detail.value?.id) return
  const tip = { pause: '暂停', resume: '恢复', end: '结束' }[action] || action
  try {
    await ElMessageBox.confirm(`确认${tip}系列「${detail.value.name}」？`, '系列控制', {
      type: action === 'end' ? 'warning' : 'info',
    })
    saving.value = true
    const res = await controlPushCampaignSeries({ id: detail.value.id, action })
    ElMessage.success(`已${tip}`)
    const data = res.results && !Array.isArray(res.results) ? res.results : null
    if (data) detail.value = { ...detail.value, ...data }
    else await openDetail(detail.value)
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e?.message || e?.msg || '操作失败')
  } finally {
    saving.value = false
  }
}

async function loadTargets(p = targetsPage.value) {
  if (!detail.value?.id) return
  targetsPage.value = p
  targetsLoading.value = true
  try {
    const params = {
      campaign_id: detail.value.id,
      currentPage: targetsPage.value,
      pageSize: 10,
    }
    if (targetStatus.value) params.status = targetStatus.value
    const res = await fetchPushCampaignTargets(params)
    targets.value = res.results || []
    targetsTotal.value = res.pagination?.total || targets.value.length
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载目标失败')
  } finally {
    targetsLoading.value = false
  }
}

function openReject() {
  rejectReason.value = ''
  rejectVisible.value = true
}

async function doReview(approve) {
  if (!detail.value?.id) return
  if (!approve && !(rejectReason.value || '').trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  saving.value = true
  try {
    const body = { id: detail.value.id, approve: !!approve }
    if (!approve) body.reject_reason = rejectReason.value.trim()
    await reviewPushCampaign(body)
    ElMessage.success(approve ? '已通过' : '已驳回')
    rejectVisible.value = false
    detailVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '审核失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load(1)
  loadReviewerOptions()
})
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tip {
  margin-top: 4px;
}
.upload-stats {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-color-primary);
}
.section-title {
  margin: 20px 0 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.review-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.user-picker {
  width: 100%;
  min-height: 40px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.user-picker:hover {
  border-color: var(--el-color-primary);
}
.user-picker-placeholder {
  flex: 1;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}
.user-picker-tags {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.user-tag-id {
  margin-left: 4px;
  opacity: 0.65;
}
.user-picker-btn {
  flex-shrink: 0;
}
.copy-fields {
  padding: 12px 4px 4px;
}
.copy-fields :deep(.el-form-item) {
  margin-bottom: 18px;
}
.copy-fields :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
