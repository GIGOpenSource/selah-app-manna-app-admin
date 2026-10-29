<!--
  订单管理：查询 IAP 订单、查看详情与更新状态；按 App 区分。
-->
<template>
  <div>
    <div class="container">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="load(1)"
      />
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="交易号 / 商品ID / 用户"
          style="width: 240px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="status" clearable placeholder="状态" style="width: 120px" @change="load(1)">
          <el-option label="生效" value="active" />
          <el-option label="过期" value="expired" />
          <el-option label="退款" value="refunded" />
          <el-option label="撤销" value="revoked" />
        </el-select>
        <el-select v-model="isTrial" clearable placeholder="试用" style="width: 100px" @change="load(1)">
          <el-option label="试用" :value="1" />
          <el-option label="正式" :value="0" />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">订单列表</div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.app_key" size="small" :type="row.app_key === 'manna' ? 'warning' : 'primary'">
              {{ row.app_key }}
            </el-tag>
            <span v-else class="sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">
            <div>{{ row.display_name || row.username || '-' }}</div>
            <div class="sub">uid {{ row.user_id }} · {{ row.device_id || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="80" />
        <el-table-column prop="product_id" label="商店商品ID" min-width="150" />
        <el-table-column prop="transaction_id" label="交易号" min-width="160" />
        <el-table-column prop="is_trial" label="试用" width="70">
          <template #default="{ row }">
            <el-tag :type="row.is_trial ? 'warning' : 'info'" size="small">{{ row.is_trial ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expire_at" label="到期" width="170" />
        <el-table-column prop="created_at" label="下单时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-dropdown v-if="row.status === 'active'" trigger="click" @command="(cmd) => onStatus(row, cmd)">
              <el-button link type="danger" style="margin-top: 5px;">更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="refunded">标记退款</el-dropdown-item>
                  <el-dropdown-item command="revoked">标记撤销</el-dropdown-item>
                  <el-dropdown-item command="expired">标记过期</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        layout="total, prev, pager, next"
        :total="total"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="detailVisible" title="订单详情" width="720px" destroy-on-close>
      <el-descriptions v-if="detail" class="order-detail" :column="2" border label-width="112px">
        <el-descriptions-item label="订单 ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="App">
          <el-tag v-if="detail.app_key" size="small" :type="detail.app_key === 'manna' ? 'warning' : 'primary'">
            {{ detail.app_key }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="用户" :span="2">
          {{ detail.display_name || detail.username || '—' }}（{{ detail.user_id }}）
        </el-descriptions-item>
        <el-descriptions-item label="设备" :span="2">{{ detail.device_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="平台">{{ detail.platform || '—' }}</el-descriptions-item>
        <el-descriptions-item label="试用">
          <el-tag :type="detail.is_trial ? 'warning' : 'info'" size="small">{{ detail.is_trial ? '是' : '否' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="到期">{{ detail.expire_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="商店商品 ID" :span="2">{{ detail.product_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="交易号" :span="2">{{ detail.transaction_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="原始交易号" :span="2">{{ detail.original_transaction_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="下单时间" :span="2">{{ detail.created_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="收据摘要" :span="2">
          <div class="order-receipt">{{ detail.receipt_data || '—' }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 订单管理：分页筛选 + 详情 + 状态变更；按 App 区分。
 * 退款/撤销会在用户无其他有效单时降级 VIP（后端副作用，确认文案已提示）。
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchOrders, fetchOrderDetail, updateOrderStatus } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'

const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const q = ref('')
const appKey = ref('')
const language = ref('')
const platform = ref('')
const status = ref(null)
const isTrial = ref(null)
const detailVisible = ref(false)
const detail = ref(null)

function statusLabel(s) {
  return { active: '生效', expired: '过期', refunded: '退款', revoked: '撤销' }[s] || s
}
function statusType(s) {
  return { active: 'success', expired: 'info', refunded: 'danger', revoked: 'warning' }[s] || 'info'
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = { currentPage: page.value, pageSize: 20 }
    if (q.value) params.q = q.value
    Object.assign(params, browseScopeParams({ appKey: appKey.value, language: language.value, platform: platform.value }))
    if (status.value) params.status = status.value
    if (isTrial.value === 0 || isTrial.value === 1) params.is_trial = isTrial.value
    const res = await fetchOrders(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  q.value = ''
  appKey.value = ''
  language.value = ''
  platform.value = ''
  status.value = null
  isTrial.value = null
  load(1)
}

async function openDetail(row) {
  try {
    const res = await fetchOrderDetail(row.id)
    detail.value = res.results || row
    detailVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  }
}

async function onStatus(row, next) {
  const label = statusLabel(next)
  await ElMessageBox.confirm(`将订单 #${row.id} 标记为「${label}」？退款/撤销会在无其他有效单时降级 VIP。`, '确认', {
    type: 'warning',
  })
  await updateOrderStatus(row.id, next)
  ElMessage.success('已更新')
  load()
}

onMounted(() => load(1))
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
}

.order-detail :deep(.el-descriptions__label) {
  white-space: nowrap;
}

.order-detail :deep(.el-descriptions__content) {
  word-break: break-all;
}

.order-receipt {
  max-height: 140px;
  overflow: auto;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
