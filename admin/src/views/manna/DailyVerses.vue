<!--
  今日经文 CRUD：按 app×language×platform 维护；App Home 读取同 scope。
  一条经文只出现一次：日间只配日间图，夜间只配夜间图，互不兼配。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">建议 Scope 切到 <code>manna</code>。一条经文只出现一次，请选<strong>日间</strong>或<strong>夜间</strong>其一并只配对应图：日间经文不配夜间图，夜间经文不配日间图。空图则用对应本地池。请用首页经文卡图（可带字）；祷告 / Quiz 枢纽不要复用。Quiz 日夜间底图在「成长规则」。轮换算法在「成长规则」。删除走 POST <code>{ delete_id }</code>。</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">今日经文</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading" class="verse-table" style="width: 100%">
      <el-table-column label="时段" width="100">
        <template #default="{ row }">
          <el-tag :type="versePeriod(row) === 'night' ? 'info' : 'warning'" size="small">
            {{ versePeriod(row) === 'night' ? '夜间' : '日间' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="背景" width="88" align="center">
        <template #default="{ row }">
          <el-image
            v-if="verseBg(row)"
            class="table-td-thumb"
            :src="verseBg(row)"
            :preview-src-list="[verseBg(row)]"
            preview-teleported
            fit="cover"
            hide-on-error
          />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="经文" min-width="200" class-name="col-verse">
        <template #default="{ row }">
          <el-tooltip
            :content="row.verse_text || '—'"
            placement="top"
            :disabled="!row.verse_text"
            :show-after="300"
          >
            <span class="verse-ellipsis">{{ row.verse_text || '—' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="出处" min-width="140">
        <template #default="{ row }">{{ row.reference || '—' }}</template>
      </el-table-column>
      <el-table-column label="生效日" width="128">
        <template #default="{ row }">{{ dateOnly(row.active_date) }}</template>
      </el-table-column>
      <el-table-column label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column label="启用" min-width="90" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="168" fixed="right">
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

    <el-dialog v-model="visible" :title="form.id ? '编辑今日经文' : '新建今日经文'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="经文"><el-input v-model="form.verse_text" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="出处"><el-input v-model="form.reference" placeholder="Isaiah 41:10" /></el-form-item>
        <!-- <el-form-item label="祷告标题"><el-input v-model="form.prayer_title" maxlength="128" placeholder="祷告标题" /></el-form-item> -->
        <el-form-item label="祷告文"><el-input v-model="form.prayer_body" type="textarea" :rows="5" placeholder="祷告文" /></el-form-item>
        <el-form-item label="书卷"><el-input v-model="form.bible_book" placeholder="Isaiah" /></el-form-item>
        <el-form-item label="章/节">
          <div class="chap-row">
            <span class="chap-lab">章</span>
            <el-input-number v-model="form.chapter" :min="0" controls-position="right" />
            <span class="chap-lab">节</span>
            <el-input-number v-model="form.verse_start" :min="0" controls-position="right" />
            <span class="chap-lab">至</span>
            <el-input-number v-model="form.verse_end" :min="0" controls-position="right" />
          </div>
        </el-form-item>
        <el-form-item label="时段">
          <el-radio-group v-model="form.period">
            <el-radio-button label="day">日间 6:00–17:00</el-radio-button>
            <el-radio-button label="night">夜间 17:00–次日 6:00</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-alert
          v-if="hasBothImages(form)"
          type="warning"
          :closable="false"
          show-icon
          title="同一条不要同时配日夜间图。保存后只保留当前时段图片。"
          style="margin: 0 0 12px 100px"
        />
        <el-form-item :label="form.period === 'night' ? '夜间背景' : '日间背景'">
          <el-input
            v-if="form.period !== 'night'"
            v-model="form.image_url"
            placeholder="6:00–17:00；空则用本地日间池"
          />
          <el-input
            v-else
            v-model="form.image_url_night"
            placeholder="17:00–次日 6:00；空则用本地夜间池"
          />
          <div class="bg-row">
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="(f) => onUpload(f, form.period === 'night' ? 'night' : 'day')"
            >
              <el-button :loading="uploading === (form.period === 'night' ? 'night' : 'day')">
                {{ form.period === 'night' ? '上传夜间' : '上传日间' }}
              </el-button>
            </el-upload>
            <el-image v-if="periodImage" :src="periodImage" class="form-thumb" fit="cover" />
          </div>
        </el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="form.active_date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
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
import { fetchDailyVerses, saveDailyVerse, uploadFile } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const uploading = ref('')

const periodImage = computed(() =>
  form.value.period === 'night'
    ? (form.value.image_url_night || '')
    : (form.value.image_url || ''),
)

function dateOnly(v) {
  const s = String(v || '').trim()
  if (!s) return '—'
  return s.slice(0, 10)
}

function verseKey(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function hasBothImages(row) {
  return !!(row?.image_url || '').trim() && !!(row?.image_url_night || '').trim()
}

function versePeriod(row) {
  if (!row) return 'day'
  if (row.period === 'night' || row.kind === 'night' || row.kind === 'evening') return 'night'
  if (row.period === 'day' || row.kind === 'morning' || row.kind === 'day') return 'day'
  const day = (row.image_url || '').trim()
  const night = (row.image_url_night || '').trim()
  if (night && !day) return 'night'
  return 'day'
}

function verseBg(row) {
  return versePeriod(row) === 'night'
    ? ((row.image_url_night || row.image_url || '').trim())
    : ((row.image_url || row.image_url_night || '').trim())
}

function onScopeChange() {
  load(1)
}

function scopeParams() {
  return browseScopeParams({
    appKey: appKey.value,
    language: language.value,
    platform: platform.value,
  })
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchDailyVerses({
      ...scopeParams(),
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

function open(row) {
  if (row) {
    const next = {
      ...row,
      period: versePeriod(row),
      prayer_title: row.prayer_title || '',
      prayer_body: row.prayer_body || '',
    }
    form.value = next
  } else {
    form.value = {
      verse_text: '',
      reference: '',
      prayer_title: '',
      prayer_body: '',
      bible_book: '',
      chapter: 0,
      verse_start: 0,
      verse_end: 0,
      image_url: '',
      image_url_night: '',
      wallpaper_id: null,
      active_date: null,
      sort_order: 0,
      enabled: true,
      period: 'day',
      app_key: defaultCreateAppKey(),
      language: language.value || '',
      platform: platform.value || '',
    }
  }
  visible.value = true
}

async function onUpload(file, slot) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = slot
  try {
    const folder = slot === 'night' ? 'manna/daily-verse/night' : 'manna/daily-verse/morning'
    const res = await uploadFile(raw, folder)
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    if (slot === 'night') {
      form.value.image_url_night = url
      form.value.image_url = ''
    } else {
      form.value.image_url = url
      form.value.image_url_night = ''
    }
    ElMessage.success('已上传')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = ''
  }
}

async function findDuplicateVerse(text, excludeId) {
  const key = verseKey(text)
  if (!key) return null
  const local = rows.value.find((r) => r.id !== excludeId && verseKey(r.verse_text) === key)
  if (local) return local
  try {
    const res = await fetchDailyVerses({
      ...scopeParams(),
      currentPage: 1,
      pageSize: 200,
    })
    const list = res.results || []
    return list.find((r) => r.id !== excludeId && verseKey(r.verse_text) === key) || null
  } catch (e) {
    return null
  }
}

async function save() {
  if (!(form.value.verse_text || '').trim()) {
    ElMessage.warning('请填写经文')
    return
  }
  const dup = await findDuplicateVerse(form.value.verse_text, form.value.id)
  if (dup) {
    ElMessage.warning(`该经文已存在（#${dup.id}），一条经文只会出现一次`)
    return
  }
  const period = form.value.period === 'night' ? 'night' : 'day'
  const payload = { ...form.value, app_key: defaultCreateAppKey() }
  delete payload.period
  if (period === 'night') {
    payload.image_url = ''
  } else {
    payload.image_url_night = ''
  }
  if (form.value.kind != null && form.value.kind !== '') {
    payload.kind = period === 'night' ? 'night' : 'morning'
  }
  try {
    await saveDailyVerse(payload)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该今日经文？', '提示', { type: 'warning' })
    await saveDailyVerse({ delete_id: id })
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
.muted { color: #999; font-size: 12px; }
.ml { margin-left: 8px; }
.chap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
}
.chap-row :deep(.el-input-number) {
  width: 112px;
  flex: none;
}
.chap-lab {
  color: #909399;
  font-size: 13px;
  flex: none;
  line-height: 32px;
}
.bg-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.form-thumb { width: 120px; height: 72px; border-radius: 8px; }
.table-td-thumb { width: 48px; height: 48px; border-radius: 6px; }
.verse-table :deep(.cell) {
  text-overflow: clip;
}
.verse-table :deep(.col-verse .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.verse-ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
