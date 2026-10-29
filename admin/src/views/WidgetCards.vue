<!--
  App 小组件卡片：运营台查看全部未删卡片，新建 / 修改 / 软删除。
  编辑只改图片、文案、描述；图片先 POST /upload/，再把 URL 写入 image_url。
-->
<template>
  <div class="container">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
      title="仅启用的卡片会下发给 App；此处可看全部未删除卡片，并修改图片、文案和描述。"
    />
    <div class="pro-search">
      <el-input
        v-model="q"
        clearable
        placeholder="搜索文案 / 描述"
        style="width: 240px"
        @keyup.enter="load(1)"
      />
      <el-select v-model="enabled" clearable placeholder="启用状态" style="width: 140px" @change="load(1)">
        <el-option label="启用" value="1" />
        <el-option label="停用" value="0" />
      </el-select>
      <div class="pro-search-actions">
        <el-button type="primary" @click="load(1)">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </div>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">小组件配置</div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="图片" width="96">
        <template #default="{ row }">
          <el-image
            v-if="row.image_url"
            class="table-td-thumb"
            :class="row.image_type === 'wide' ? 'is-wide' : 'is-square'"
            :src="row.image_url"
            :preview-src-list="[row.image_url]"
            preview-teleported
            fit="cover"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="text" label="文案" min-width="140" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="图型" width="80">
        <template #default="{ row }">{{ imageTypeLabel(row.image_type) }}</template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next, jumper"
      :total="total"
      v-model:current-page="page"
      :page-size="pageSize"
      @current-change="load"
    />

    <el-dialog v-model="visible" :title="form.id ? '编辑小组件卡片' : '新建小组件卡片'" width="560px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="文案" required>
          <el-input v-model="form.text" maxlength="128" placeholder="如 Peace" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
        <el-form-item label="图片" required>
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="onUpload"
          >
            <el-button :loading="uploading" size="small">上传图片</el-button>
          </el-upload>
          <el-input v-model="form.image_url" placeholder="上传后自动填入 URL" style="margin-top: 8px" />
          <div v-if="form.image_url" class="preview">
            <el-image
              :src="form.image_url"
              fit="cover"
              :style="form.image_type === 'wide'
                ? 'width: 160px; height: 80px; border-radius: 8px'
                : 'width: 80px; height: 80px; border-radius: 8px'"
            />
          </div>
        </el-form-item>
        <template v-if="!form.id">
          <el-form-item label="图型">
            <el-radio-group v-model="form.image_type">
              <el-radio value="square">方图</el-radio>
              <el-radio value="wide">长图</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchWidgetCards, saveWidgetCard, uploadFile } from '../api'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { defaultCreateAppKey } from '../utils/scopeParams'

const q = ref('')
const enabled = ref('')
const rows = ref([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const uploading = ref(false)

function imageTypeLabel(v) {
  return v === 'wide' ? '长图' : '方图'
}

function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function cacheKey() {
  return `widget_cards_p${page.value}_${q.value || ''}_${enabled.value}`
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const params = {
        currentPage: page.value,
        pageSize,
      }
      if (q.value) params.q = q.value.trim()
      if (enabled.value === '1' || enabled.value === '0') params.enabled = enabled.value
      const res = await fetchWidgetCards(params)
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  q.value = ''
  enabled.value = ''
  load(1)
}

function open(row) {
  form.value = row
    ? {
        id: row.id,
        text: row.text || '',
        description: row.description || '',
        image_url: row.image_url || '',
        image_type: row.image_type === 'wide' ? 'wide' : 'square',
        sort_order: row.sort_order ?? 0,
        enabled: !!row.enabled,
        app_key: row.app_key || '',
        language: row.language || '',
        platform: row.platform || '',
      }
    : {
        text: '',
        description: '',
        image_url: '',
        image_type: 'square',
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(),
        language: '',
        platform: '',
      }
  visible.value = true
}

async function onUpload(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/widget-cards')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.image_url = url
    ElMessage.success('已上传，URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  const text = (form.value.text || '').trim()
  const imageUrl = (form.value.image_url || '').trim()
  if (!text) {
    ElMessage.warning('请填写文案')
    return
  }
  if (!imageUrl) {
    ElMessage.warning('请上传或填写图片 URL')
    return
  }
  const payload = form.value.id
    ? {
        id: form.value.id,
        text,
        description: (form.value.description || '').trim(),
        image_url: imageUrl,
        image_type: form.value.image_type === 'wide' ? 'wide' : 'square',
        sort_order: Number(form.value.sort_order) || 0,
        enabled: !!form.value.enabled,
        app_key: form.value.app_key || '',
        language: form.value.language || '',
        platform: form.value.platform || '',
      }
    : {
        text,
        description: (form.value.description || '').trim(),
        image_url: imageUrl,
        image_type: form.value.image_type === 'wide' ? 'wide' : 'square',
        sort_order: 0,
        enabled: !!form.value.enabled,
        app_key: defaultCreateAppKey(),
        language: '',
        platform: '',
      }
  try {
    await saveWidgetCard(payload)
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page-tip {
  margin-bottom: 12px;
}
.table-td-thumb {
  border-radius: 8px;
}
.table-td-thumb.is-square {
  width: 40px;
  height: 40px;
}
.table-td-thumb.is-wide {
  width: 72px;
  height: 40px;
}
.preview {
  margin-top: 8px;
}
</style>
