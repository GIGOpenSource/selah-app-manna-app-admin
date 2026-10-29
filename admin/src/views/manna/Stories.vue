<!--
  Manna 圣经故事：有序 blocks（段落 / 插图），封面从插图里选一张。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      正文按「一段文字 + 一张插图」成组添加。封面从插图里选，列表卡和详情顶栏都用这张。建议 3～4 组，最多 6 组。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">圣经故事</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="封面" width="88">
        <template #default="{ row }">
          <el-image
            v-if="coverSrc(row)"
            class="table-td-thumb"
            :src="coverSrc(row)"
            :preview-src-list="[coverSrc(row)]"
            preview-teleported
            fit="cover"
          />
          <span v-else class="muted">未选</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column label="插图" width="70">
        <template #default="{ row }">{{ imageCountOf(row) }}</template>
      </el-table-column>
      <el-table-column prop="linked_level_id" label="关联关卡" width="100" />
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column prop="app_key" label="App名" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
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

    <el-dialog v-model="visible" :title="form.id ? '编辑故事' : '新建故事'" width="760px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="正文" required>
          <div class="block-list">
            <div v-for="(p, i) in pairs" :key="p._key" class="pair-card">
              <div class="block-head">
                <span class="block-type">第 {{ i + 1 }} 组</span>
                <el-radio
                  v-if="p.url"
                  v-model="coverPairKey"
                  :value="p._key"
                  class="cover-radio"
                >封面</el-radio>
                <div class="block-head__actions">
                  <el-button link :disabled="i === 0" @click="movePair(i, -1)">上移</el-button>
                  <el-button link :disabled="i === pairs.length - 1" @click="movePair(i, 1)">下移</el-button>
                  <el-button
                    class="opt-del"
                    circle
                    plain
                    type="danger"
                    :icon="Delete"
                    :disabled="pairs.length <= 1"
                    @click="removePair(i)"
                  />
                </div>
              </div>
              <el-input
                v-model="p.text"
                type="textarea"
                :rows="4"
                placeholder="段落文字"
              />
              <div class="img-block">
                <el-upload
                  :class="'block-uploader-' + p._key"
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/*"
                  :on-change="(f) => onUploadBlock(f, p._key)"
                >
                  <div v-if="p.url" class="cover-preview">
                    <img :src="p.url" alt="" />
                    <div class="cover-preview__mask">点击更换</div>
                  </div>
                  <el-button v-else type="primary" plain :loading="uploading === p._key">上传插图</el-button>
                </el-upload>
                <div v-if="p.url" class="cover-actions">
                  <el-button size="small" :loading="uploading === p._key" @click="triggerBlockPick(p._key)">重新上传</el-button>
                  <el-button size="small" type="danger" plain @click="clearPairImage(p)">清除</el-button>
                </div>
                <el-input v-model="p.alt" placeholder="图片说明（可选）" style="margin-top: 8px" />
              </div>
            </div>
            <div class="block-add">
              <el-button
                size="small"
                :icon="CirclePlusFilled"
                :disabled="pairs.length >= MAX_IMAGES"
                @click="addPair"
              >添加一组（段落 + 插图）</el-button>
              <span class="field-hint">{{ pairs.length }}/{{ MAX_IMAGES }} 组</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="关联关卡"><el-input-number v-model="form.linked_level_id" :min="0" /></el-form-item>
        <el-form-item label="知识卡">
          <div class="card-list">
            <div v-for="(c, i) in form.knowledge_cards" :key="i" class="card-row">
              <el-input v-model="c.title" placeholder="标题" />
              <el-input v-model="c.body" type="textarea" :rows="2" placeholder="正文" />
              <el-button
                class="opt-del"
                circle
                plain
                type="danger"
                :icon="Delete"
                @click="form.knowledge_cards.splice(i, 1)"
              />
            </div>
            <el-button size="small" :icon="CirclePlusFilled" @click="addCard">添加知识卡</el-button>
            <p class="field-hint">可选。详情正文以 blocks 为准。</p>
          </div>
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
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled, Delete } from '@element-plus/icons-vue'
import { fetchMannaStories, saveMannaStory, uploadFile } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

const MAX_IMAGES = 6
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
const pairs = ref([])
const coverPairKey = ref(null)
let blockSeq = 1

function newPair(text = '', image = {}) {
  return {
    _key: blockSeq++,
    text: String(text || ''),
    url: String(image.url || '').trim(),
    alt: String(image.alt || ''),
  }
}

function parseBlocks(raw, withKey = true) {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = [] }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((b) => {
    if (b?.type === 'image') {
      const item = { type: 'image', url: String(b.url || '').trim(), alt: String(b.alt || '') }
      if (withKey) item._key = blockSeq++
      return item
    }
    const item = { type: 'text', text: String(b.text || b.body || '') }
    if (withKey) item._key = blockSeq++
    return item
  })
}

function hydrateBlocks(row) {
  const fromApi = parseBlocks(row?.blocks, false)
  if (fromApi.length) return fromApi
  const blocks = []
  const body = String(row?.body || '').trim()
  if (body) blocks.push({ type: 'text', text: body })
  const cover = String(row?.cover_url || row?.card_url || '').trim()
  if (cover) blocks.push({ type: 'image', url: cover, alt: '' })
  return blocks
}

function blocksToPairs(blocks) {
  const out = []
  let i = 0
  const list = blocks || []
  while (i < list.length) {
    const cur = list[i]
    if (cur.type === 'text') {
      const next = list[i + 1]
      if (next?.type === 'image') {
        out.push(newPair(cur.text, next))
        i += 2
      } else {
        out.push(newPair(cur.text, {}))
        i += 1
      }
    } else if (cur.type === 'image') {
      out.push(newPair('', cur))
      i += 1
    } else {
      i += 1
    }
  }
  return out.length ? out : [newPair()]
}

function imageBlocks(list) {
  return (list || []).filter((b) => b.type === 'image')
}

function imageCountOf(row) {
  const n = imageBlocks(parseBlocks(row?.blocks, false)).filter((b) => b.url).length
  if (n) return n
  return row?.cover_url || row?.card_url ? 1 : 0
}

function coverSrc(row) {
  const imgs = imageBlocks(parseBlocks(row?.blocks, false)).filter((b) => b.url)
  const idx = Number(row?.cover_image_index)
  if (imgs.length) return imgs[Number.isFinite(idx) && idx >= 0 ? idx : 0]?.url || imgs[0].url
  return String(row?.cover_url || row?.card_url || '').trim()
}

function coverImageIndex() {
  const imgs = pairs.value.filter((p) => p.url)
  const i = imgs.findIndex((p) => p._key === coverPairKey.value)
  return i >= 0 ? i : 0
}

function addPair() {
  if (pairs.value.length >= MAX_IMAGES) {
    ElMessage.warning('最多 6 组图文')
    return
  }
  pairs.value.push(newPair())
}

function removePair(i) {
  if (pairs.value.length <= 1) return
  const [removed] = pairs.value.splice(i, 1)
  if (removed?._key === coverPairKey.value) {
    coverPairKey.value = pairs.value.find((p) => p.url)?._key || null
  }
}

function movePair(i, dir) {
  const j = i + dir
  if (j < 0 || j >= pairs.value.length) return
  const list = pairs.value
  const tmp = list[i]
  list[i] = list[j]
  list[j] = tmp
}

function clearPairImage(p) {
  p.url = ''
  if (coverPairKey.value === p._key) {
    coverPairKey.value = pairs.value.find((x) => x.url)?._key || null
  }
}

function addCard() {
  if (!Array.isArray(form.value.knowledge_cards)) form.value.knowledge_cards = []
  form.value.knowledge_cards.push({ title: '', body: '' })
}

function triggerBlockPick(key) {
  const input = document.querySelector(`.block-uploader-${key} input[type="file"]`)
  if (input) input.click()
}

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchMannaStories({
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

function open(row) {
  if (row) {
    const next = { ...row }
    next.knowledge_cards = (() => {
      let cards = row.knowledge_cards
      if (typeof cards === 'string') {
        try { cards = JSON.parse(cards) } catch { cards = [] }
      }
      return Array.isArray(cards) ? cards.map((c) => ({
        title: c.title || '',
        body: c.body || c.text || '',
      })) : []
    })()
    form.value = next
    pairs.value = blocksToPairs(hydrateBlocks(row))
    const idx = Number(row.cover_image_index)
    const withUrl = pairs.value.filter((p) => p.url)
    const hit = Number.isFinite(idx) && idx >= 0 ? withUrl[idx] : null
    const byUrl = pairs.value.find((p) => p.url && p.url === (row.cover_url || row.card_url))
    coverPairKey.value = hit?._key || byUrl?._key || withUrl[0]?._key || null
  } else {
    form.value = {
      title: '',
      cover_image_index: 0,
      knowledge_cards: [],
      linked_level_id: null,
      sort_order: 0,
      enabled: true,
      app_key: defaultCreateAppKey(),
      language: language.value || '',
      platform: platform.value || '',
    }
    pairs.value = [newPair()]
    coverPairKey.value = null
  }
  visible.value = true
}

async function onUploadBlock(file, key) {
  const raw = file?.raw
  if (!raw || key == null) return
  uploading.value = key
  try {
    const res = await uploadFile(raw, 'manna/stories')
    const url = res.results?.url || res.data?.url || res.url || ''
    if (!url) throw new Error('未返回 URL')
    const p = pairs.value.find((x) => x._key === key)
    if (p) p.url = url
    if (coverPairKey.value == null) coverPairKey.value = key
    ElMessage.success('插图已上传，请点保存')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = ''
  }
}

function serializeBlocks() {
  return pairs.value.flatMap((p) => {
    const items = []
    const text = String(p.text || '').trim()
    const url = String(p.url || '').trim()
    if (text) items.push({ type: 'text', text })
    if (url) {
      const img = { type: 'image', url }
      const alt = String(p.alt || '').trim()
      if (alt) img.alt = alt
      items.push(img)
    }
    return items
  })
}

async function save() {
  if (!(form.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  const incomplete = pairs.value.find((p) => !String(p.text || '').trim() || !String(p.url || '').trim())
  if (incomplete) {
    ElMessage.warning('每一组都要填写段落并上传插图')
    return
  }
  const blocks = serializeBlocks()
  if (!blocks.some((b) => b.type === 'text')) {
    ElMessage.warning('请至少写一段正文')
    return
  }
  if (!blocks.some((b) => b.type === 'image')) {
    ElMessage.warning('请至少上传一张插图作为封面')
    return
  }
  const payload = {
    ...form.value,
    app_key: defaultCreateAppKey(),
    blocks,
    cover_image_index: coverImageIndex(),
    knowledge_cards: (form.value.knowledge_cards || [])
      .map((c) => ({ title: String(c.title || '').trim(), body: String(c.body || '').trim() }))
      .filter((c) => c.title || c.body),
  }
  delete payload.body
  delete payload.cover_url
  delete payload.card_url
  delete payload.unlock_cost
  try {
    await saveMannaStory(payload)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该故事？', '提示', { type: 'warning' })
    await saveMannaStory({ delete_id: id })
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
.muted { color: #909399; font-size: 12px; }
.table-td-thumb { width: 48px; height: 64px; border-radius: 8px; }
.block-list, .card-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pair-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-type {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}
.cover-radio {
  margin-right: 0;
}
.block-head__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.block-add {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  padding-right: 44px;
}
.card-row .opt-del {
  position: absolute;
  right: 0;
  top: 0;
}
.opt-del { flex: none; }
.img-block { width: 100%; }
.cover-preview {
  position: relative;
  width: 200px;
  height: 120px;
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
.cover-preview:hover .cover-preview__mask { opacity: 1; }
.cover-actions { display: flex; gap: 8px; margin-top: 8px; }
.field-hint {
  margin: 6px 0 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}
</style>
