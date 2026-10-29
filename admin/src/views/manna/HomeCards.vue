<!--
  Home 运营卡：标题/副标题 + App×语言×设备；跳转选产品内路由（中文对照）。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      App 首页底部横滑卡由此配置。跳转请选「产品内页面」，勿手填外链。建议 Scope 切到 <code>manna</code>。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">Home 运营卡</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="封面" width="72">
        <template #default="{ row }">
          <el-image
            v-if="row.cover_url"
            class="table-td-thumb"
            :src="row.cover_url"
            :preview-src-list="[row.cover_url]"
            preview-teleported
            fit="cover"
            hide-on-error
          />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="140" />
      <el-table-column prop="subtitle" label="副标题" min-width="180" show-overflow-tooltip />
      <el-table-column label="跳转页面" min-width="160">
        <template #default="{ row }">{{ routeLabel(row.link_path) }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App名" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language ? langOptionLabel(row.language) : '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ platformLabel(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column prop="enabled" label="启用" min-width="90" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row.id)">删除</el-button>
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

    <el-dialog v-model="visible" :title="form.id ? '编辑 Home 运营卡' : '新建 Home 运营卡'" width="640px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="128" placeholder="如 Daily Quiz" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" maxlength="255" placeholder="如 Grow with leveled questions" />
        </el-form-item>
        <el-form-item label="封面">
          <div class="cover-field">
            <el-upload
              class="cover-uploader"
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="onUploadCover"
            >
              <div v-if="form.cover_url" class="cover-preview">
                <img :src="form.cover_url" alt="cover" />
                <div class="cover-preview__mask">点击更换</div>
              </div>
              <el-button v-else type="primary" plain :loading="uploading">上传封面</el-button>
            </el-upload>
            <div class="cover-actions">
              <el-button
                v-if="form.cover_url"
                size="small"
                :loading="uploading"
                @click="triggerCoverPick"
              >重新上传</el-button>
              <el-button
                v-if="form.cover_url"
                size="small"
                type="danger"
                plain
                @click="form.cover_url = ''"
              >清除</el-button>
            </div>
            <p class="field-hint">上传卡片图标 / 封面图到 COS，可留空。</p>
          </div>
        </el-form-item>
        <el-form-item label="跳转页面" required>
          <el-select v-model="form.link_path" filterable style="width: 100%" @change="onRouteChange">
            <el-option
              v-for="r in MANNA_APP_ROUTE_OPTIONS"
              :key="r.value"
              :label="r.label"
              :value="r.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="selectedRoute?.needsId" label="详情 ID">
          <el-input-number v-model="form.target_id" :min="0" controls-position="right" />
          <span class="inline-hint">{{ selectedRoute.idHint || '写入 payload，客户端拼到 ?id=' }}</span>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日">
          <el-date-picker
            v-model="form.active_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="空=长期有效"
            clearable
          />
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchMannaHomeCards, saveMannaHomeCard, uploadFile } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import {
  LANG_OPTIONS,
  langOptionLabel,
  MANNA_APP_ROUTE_OPTIONS,
  mannaRouteByPath,
} from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const uploading = ref(false)

const selectedRoute = computed(() => mannaRouteByPath(form.value.link_path))

function platformLabel(p) {
  if (!p) return '全部'
  if (p === 'ios') return 'iOS'
  if (p === 'android') return 'Android'
  return p
}

function routeLabel(path) {
  const hit = mannaRouteByPath(path)
  if (hit) return hit.label
  return path || '—'
}

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchMannaHomeCards({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: page.value,
      pageSize: 20,
    })
    rows.value = res.results || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function payloadTargetId(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const raw = p.target_id ?? p.series_id ?? p.story_id ?? p.level_id ?? p.testimony_id
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function onRouteChange(path) {
  const hit = mannaRouteByPath(path)
  if (hit?.type) form.value.card_type = hit.type
  if (!hit?.needsId) form.value.target_id = undefined
}

async function onUploadCover(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'manna/home-cards')
    const url = res.results?.url || res.data?.url || res?.url || ''
    if (!url) throw new Error('未返回 URL')
    form.value.cover_url = url
    ElMessage.success('封面已上传，请点保存')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = false
  }
}

function triggerCoverPick() {
  const input = document.querySelector('.cover-uploader input[type="file"]')
  if (input) input.click()
}

function open(row) {
  if (row) {
    form.value = {
      ...row,
      target_id: payloadTargetId(row.payload),
      link_path: row.link_path || '',
      card_type: row.card_type || '',
    }
  } else {
    form.value = {
      title: '',
      subtitle: '',
      cover_url: '',
      link_path: '/pages/quiz/quiz',
      card_type: 'daily_quiz',
      target_id: undefined,
      payload: {},
      sort_order: 0,
      enabled: true,
      active_date: null,
      app_key: defaultCreateAppKey(),
      language: language.value || '',
      platform: platform.value || '',
    }
  }
  visible.value = true
}

async function save() {
  if (!(form.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!(form.value.link_path || '').trim()) {
    ElMessage.warning('请选择跳转页面')
    return
  }
  const hit = mannaRouteByPath(form.value.link_path)
  const payload = { ...(form.value.payload || {}) }
  if (hit?.needsId) {
    const id = form.value.target_id
    if (!id) {
      ElMessage.warning('该页面需要填写详情 ID')
      return
    }
    payload.target_id = id
    if (hit.type === 'devotion_detail') payload.series_id = id
  } else {
    delete payload.target_id
  }
  try {
    await saveMannaHomeCard({
      id: form.value.id,
      title: String(form.value.title || '').trim(),
      subtitle: String(form.value.subtitle || '').trim(),
      cover_url: form.value.cover_url || '',
      link_path: form.value.link_path,
      card_type: hit?.type || form.value.card_type || '',
      payload,
      sort_order: form.value.sort_order ?? 0,
      enabled: !!form.value.enabled,
      active_date: form.value.active_date || null,
      app_key: defaultCreateAppKey(),
      language: form.value.language ?? '',
      platform: form.value.platform ?? '',
    })
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该运营卡？', '提示', { type: 'warning' })
    await saveMannaHomeCard({ delete_id: id })
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.plugins-tips { margin: 0 0 12px; color: #666; font-size: 13px; line-height: 1.5; }
.field-hint { margin: 6px 0 0; color: #999; font-size: 12px; line-height: 1.4; }
.inline-hint { margin-left: 12px; color: #999; font-size: 12px; }
.muted { color: #999; font-size: 12px; }
.table-td-thumb { width: 48px; height: 48px; border-radius: 6px; }
.cover-field { width: 100%; }
.cover-preview {
  position: relative;
  width: 120px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  cursor: pointer;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-preview__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.cover-preview:hover .cover-preview__mask {
  opacity: 1;
}
.cover-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
