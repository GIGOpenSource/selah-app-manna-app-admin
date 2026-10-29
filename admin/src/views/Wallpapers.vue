<!--
  壁纸列表 / 编辑。显性筛选与合集只在「显性标签」维护。
-->
<template>
  <div class="cms-page">
    <el-alert type="info" :closable="false" show-icon title="本模块仅维护 selah，壁纸名称统一使用 English。" />

    <el-tabs v-show="!editing" v-model="panel" style="margin-bottom: 8px" @tab-change="onPanelChange">
      <el-tab-pane label="壁纸配置" name="list" />
      <el-tab-pane label="回收站" name="trash" />
    </el-tabs>

    <div v-show="!editing" class="container">
      <p v-if="panel === 'trash'" class="plugins-tips">软删除壁纸可在此恢复。</p>
      <p v-else class="plugins-tips">后台归类来自隐性标签。壁纸进入哪些前端筛选和合集，请到「显性标签」维护。</p>
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索名称或 ID"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="tagType" style="width: 160px" @change="onPrimaryChange">
          <el-option label="全部一级标签" value="all" />
          <el-option v-for="t in wallpaperTypes" :key="t.key" :label="zhTypeLabel(t)" :value="t.key" />
        </el-select>
        <el-select
          v-model="tagName"
          filterable
          :disabled="tagType === 'all'"
          :placeholder="tagType === 'all' ? '先选一级标签' : '全部二级标签'"
          style="width: 180px"
          @change="load(1)"
        >
          <el-option label="全部二级标签" value="all" />
          <el-option v-for="opt in secondaryOpts" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <template v-if="panel === 'list'">
          <el-select v-model="status" style="width: 120px" @change="load(1)">
            <el-option label="全部状态" value="all" />
            <el-option label="已启用" value="published" />
            <el-option label="已停用" value="disabled" />
          </el-select>
          <el-select v-model="requiredTags" style="width: 140px" @change="load(1)">
            <el-option label="必填标签" value="all" />
            <el-option label="必填齐全" value="complete" />
            <el-option label="缺必填标签" value="missing" />
          </el-select>
          <el-select v-model="vip" style="width: 120px" @change="load(1)">
            <el-option label="是否 VIP" value="all" />
            <el-option label="VIP" value="vip" />
            <el-option label="非 VIP" value="free" />
          </el-select>
        </template>
        <div class="pro-search-actions">
          <template v-if="panel === 'list'">
            <el-button @click="toggleBulk">{{ bulkMode ? '退出管理' : '管理' }}</el-button>
            <el-dropdown trigger="click" popper-class="import-drop" @command="openImport">
              <el-button>
                <el-icon><Upload /></el-icon>
                导入
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="files">
                    <span class="drop-item">
                      <strong>导入新图片</strong>
                      <span>批量上传图片/视频，名称取文件名</span>
                    </span>
                  </el-dropdown-item>
                  <el-dropdown-item command="replace">
                    <span class="drop-item">
                      <strong>导入替换旧内容</strong>
                      <span>上传「管理」导出的表格（带ID），覆盖修改</span>
                    </span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button type="primary" :icon="CirclePlusFilled" @click="openEditor()">新建壁纸</el-button>
          </template>
          <el-button v-else @click="load(1)">刷新回收站</el-button>
        </div>
      </div>
      <div class="wp-list-bar">
        <span>共 {{ total }} 张</span>
        <span v-if="panel === 'list'" class="wp-miss">
          <el-icon><WarningFilled /></el-icon>
          缺必填标签 {{ summary?.missing_required_tags ?? 0 }} 张
        </span>
      </div>
      <div v-if="bulkMode" class="cms-batch-bar">
        <strong>已选 {{ selectedIds.length }}</strong>
        <div>
          <el-button :disabled="!selectedIds.length" @click="openBatch('add')">加标签</el-button>
          <el-button :disabled="!selectedIds.length" @click="openBatch('remove')">移除标签</el-button>
          <el-button :disabled="!selectedIds.length" :loading="exporting" @click="runExport">导出</el-button>
          <el-button type="danger" :disabled="!selectedIds.length" @click="onBulkDelete">批量删除</el-button>
        </div>
      </div>
      <el-table
        ref="tableRef"
        :data="rows"
        v-loading="loading"
        class="allow-wrap"
        row-key="id"
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="bulkMode" type="selection" width="48" />
        <el-table-column type="index" label="序号" width="72" :index="rowNo" />
        <el-table-column label="ID" width="96" sortable :sort-method="sortById">
          <template #default="{ row }">
            <span class="cms-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="壁纸" min-width="220">
          <template #default="{ row }">
            <div class="cms-wallpaper-cell">
              <el-image
                v-if="thumb(row)"
                class="cms-thumb"
                :src="thumb(row)"
                :preview-src-list="[thumb(row)]"
                preview-teleported
                fit="cover"
              />
              <span v-else class="cms-thumb cms-thumb-empty" />
              <div>
                <strong>{{ row.name_en || '未命名' }}</strong>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="VIP" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_vip" type="warning" size="small">VIP</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="必填标签" width="110">
          <template #default="{ row }">
            <el-tooltip v-if="requiredCell(row).missing.length" :content="requiredCell(row).missing.join('、')" placement="top">
              <el-tag type="danger" size="small">缺失</el-tag>
            </el-tooltip>
            <el-tag v-else type="success" size="small">齐全</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用次数" width="100">
          <template #default="{ row }">{{ row.uses || 0 }} 次</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <span v-if="bulkMode">—</span>
            <template v-else-if="panel === 'trash'">
              <el-button link type="primary" @click="onRestore(row)">恢复</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
              <el-button link type="primary" @click="toggleStatus(row)">
                {{ row.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="onSoftDelete(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loading && !rows.length" class="cms-empty">
        {{ hasFilters ? '没有找到符合条件的壁纸' : '还没有壁纸，点击右上角新建' }}
      </div>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        :page-size="PAGE_SIZE"
        @current-change="load"
      />
    </div>

    <div v-if="editing" class="container">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="壁纸标签全部来自隐性标签"
        description="主题、场景、情绪、视觉风格和自定义壁纸标签会实时读取已启用选项。"
      />
      <div class="pro-toolbar">
        <div>
          <div class="pro-toolbar-title">{{ form.id ? '编辑壁纸' : '新建壁纸' }}</div>
          <p class="cms-hint">上传素材并维护后台归类；前端筛选和合集请到「显性标签」配置。</p>
        </div>
      </div>
      <div class="pro-form-pad">
        <div class="cms-form-grid">
          <div class="full">
            <label class="cms-field-label">壁纸素材 <span class="cms-req">*</span></label>
            <div class="cms-upload" @click="onAssetBoxClick">
              <input
                ref="assetInput"
                type="file"
                :accept="ASSET_ACCEPT"
                hidden
                @change="onAssetFile"
              />
              <video
                v-if="isVideo && form.video_url"
                class="cms-upload-preview"
                :src="form.video_url"
                controls
                muted
                playsinline
                preload="metadata"
                @click.stop
              />
              <span v-else class="cms-upload-preview" :style="assetImageStyle" />
              <span class="cms-upload-copy">
                <strong>{{ assetName || '点击上传壁纸素材' }}</strong>
                <small>建议竖版 3:4；图片 JPG / PNG / GIF / WebP / AVIF / BMP，视频 MP4 / M4V / MOV / WebM，单个文件不超过 15 MB</small>
                <small>{{ uploading ? '上传中…' : (isVideo ? '已上传视频，可点击替换；封面请在下方单独上传' : '已有素材可点击此处替换') }}</small>
              </span>
            </div>
          </div>
          <div v-if="isVideo" class="full">
            <label class="cms-field-label">壁纸封面 <span class="cms-req">*</span></label>
            <label class="cms-upload">
              <input
                type="file"
                :accept="IMAGE_ACCEPT"
                hidden
                @change="onPosterFile"
              />
              <span class="cms-upload-preview" :style="posterStyle" />
              <span class="cms-upload-copy">
                <strong>{{ posterName || '点击上传壁纸封面' }}</strong>
                <small>建议竖版 3:4；仅支持图片：JPG、JPEG、PNG、GIF、WebP、AVIF、BMP，不超过 15 MB。封面为必填。</small>
                <small>{{ posterUploading ? '上传中…' : '用于列表和 App 封面预览' }}</small>
              </span>
            </label>
          </div>
          <div class="full">
            <label class="cms-field-label">English 名称 <span class="cms-req">*</span></label>
            <el-input v-model="form.name_en" placeholder="例如 Morning Light" />
            <div class="cms-hint">素材名称以英语为主，不必填写西语、葡语。</div>
          </div>
          <div class="full">
            <div class="cms-switch-row">
              <div>
                <strong>VIP 壁纸</strong>
                <div class="cms-hint">开启后 App 单张壁纸显示锁标识。</div>
              </div>
              <el-switch v-model="form.is_vip" />
            </div>
          </div>
          <div class="cms-section-head">
            <strong>后台归类</strong>
            <span>用于筛选、推荐和内容分析，不直接显示在前端。</span>
          </div>
          <div>
            <label class="cms-field-label">主主题 <span :class="reqClass('theme')">{{ reqText('theme') }}</span></label>
            <TagSelector v-model="form.theme" :options="withSelectedTags(allTags, 'theme', form.theme)" placeholder="选择主主题" />
          </div>
          <div>
            <label class="cms-field-label">壁纸视觉风格 <span :class="reqClass('visual')">{{ reqText('visual', true) }}</span></label>
            <TagSelector
              v-model="form.visual_tags"
              multiple
              :options="withSelectedTags(allTags, 'visual', form.visual_tags)"
              placeholder="搜索并选择视觉风格"
            />
          </div>
          <div>
            <label class="cms-field-label">生活场景 <span :class="reqClass('scenario')">{{ reqText('scenario', true) }}</span></label>
            <TagSelector
              v-model="form.scenario_tags"
              multiple
              :options="withSelectedTags(allTags, 'scenario', form.scenario_tags)"
              placeholder="搜索并选择生活场景"
            />
          </div>
          <div>
            <label class="cms-field-label">情绪 <span :class="reqClass('emotion')">{{ reqText('emotion', true) }}</span></label>
            <TagSelector
              v-model="form.emotion_tags"
              multiple
              :options="withSelectedTags(allTags, 'emotion', form.emotion_tags)"
              placeholder="搜索并选择情绪"
            />
          </div>
          <div v-for="t in customWpTypes" :key="t.key">
            <label class="cms-field-label">
              {{ zhTypeLabel(t) }}
              <span :class="t.required ? 'cms-req' : 'cms-hint'">{{ t.required ? '* 必填，可多选' : '选填，可多选' }}</span>
            </label>
            <TagSelector
              v-model="form.taxonomy[t.key]"
              multiple
              :options="withSelectedTags(allTags, t.key, form.taxonomy[t.key])"
              :placeholder="`搜索并选择${zhTypeLabel(t)}`"
            />
          </div>
        </div>
        <el-collapse style="margin-top: 16px">
          <el-collapse-item title="高级字段（排序）" name="adv">
            <el-form label-width="100px">
              <el-form-item label="排序权重"><el-input-number v-model="form.sort_weight" :min="0" /></el-form-item>
            </el-form>
          </el-collapse-item>
        </el-collapse>
        <div class="cms-editor-foot">
          <span class="cms-editor-state">{{ footerState }}</span>
          <div>
            <el-button @click="editing = false">取消</el-button>
            <el-button v-if="form.status === 1" @click="save(0)">停用</el-button>
            <el-button v-if="form.status !== 1" @click="save(0)">保存为已停用</el-button>
            <el-button type="primary" :loading="uploading || posterUploading" @click="save(1)">{{ form.status === 1 ? '发布更新' : '发布' }}</el-button>
          </div>
        </div>
      </div>
    </div>

    <BatchTagDialog
      v-model="batchOpen"
      :op="batchOp"
      :types="wallpaperTypes"
      :tags="allTags"
      :count="selectedIds.length"
      @apply="applyBatch"
    />

    <el-dialog v-model="importOpen" :title="importKind === 'files' ? '导入新图片' : '导入替换旧内容'" width="760px" destroy-on-close @closed="clearNewThumbs">
      <template v-if="importKind === 'files'">
        <ul class="import-rules">
          <li>图片 JPG / PNG / GIF / WebP / AVIF / BMP，视频 MP4 / M4V / MOV / WebM，单个不超过 15 MB。</li>
          <li>一次最多 100 个。名称取文件名（去掉后缀）。状态为停用，标签为空。</li>
          <li>任一文件校验失败，整批不导入。</li>
        </ul>
        <el-upload
          :auto-upload="false"
          multiple
          :limit="100"
          :accept="ASSET_ACCEPT"
          :on-change="onPickAssets"
          :on-remove="onPickAssets"
        >
          <el-button>选择图片或视频</el-button>
        </el-upload>
        <el-table v-if="newFiles.length" :data="newFiles" size="small" max-height="280" style="margin-top: 12px">
          <el-table-column label="预览" width="72">
            <template #default="{ row }">
              <img v-if="row.thumb" :src="row.thumb" alt="" class="import-thumb" />
              <span v-else>视频</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column label="校验" min-width="140">
            <template #default="{ row }">
              <el-tag :type="row.error ? 'danger' : 'success'" size="small">{{ row.error || '通过' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <template v-else>
        <ul class="import-rules">
          <li>只能按已有壁纸 ID 覆盖，不能新增。ID 请勿改。</li>
          <li>图片链接只读，导入时忽略。换图请到编辑页。</li>
          <li>名称、VIP 留空不修改。VIP 填「是 / 否」。</li>
          <li>标签写成「一级/二级」，逗号隔开则整格替换。状态留空则停用。</li>
          <li>没有 ID、ID 不存在、在回收站、ID 重复、标签写错或缺必填标签时，整张表不导入。</li>
        </ul>
        <el-upload
          :auto-upload="false"
          :limit="1"
          accept=".csv,.xlsx,.xlsm,text/csv"
          :on-change="onImportFile"
          :on-remove="() => { importFile = null }"
        >
          <el-button>选择 CSV / Excel</el-button>
        </el-upload>
        <el-table v-if="importErrors.length" :data="importErrors" size="small" max-height="240" style="margin-top: 12px">
          <el-table-column label="行" width="72" prop="row" />
          <el-table-column label="列" width="120" prop="column" />
          <el-table-column label="说明" min-width="240" prop="message" />
        </el-table>
      </template>
      <template #footer>
        <el-button @click="importOpen = false">取消</el-button>
        <el-button v-if="importKind === 'files' && importedIds.length" type="primary" @click="manageImported">去管理这批</el-button>
        <el-button v-else type="primary" :loading="importing" :disabled="importKind === 'files' && (!newFiles.length || newFiles.some((f) => f.error))" @click="runImport">
          {{ importKind === 'files' ? '开始导入' : '覆盖导入' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled, WarningFilled } from '@element-plus/icons-vue'
import {
  fetchWallpapers, saveWallpaper, deleteWallpaper, restoreWallpaper, uploadFile,
  importWallpapersFile, exportWallpapers, bulkWallpaperTags,
  fetchTagTypes, fetchLibraryTags,
} from '../api'
import TagSelector from '../components/TagSelector.vue'
import BatchTagDialog from '../components/BatchTagDialog.vue'
import { defaultCreateAppKey } from '../utils/scopeParams'
import {
  typeApplies, missingRequiredTypes, missingEnglish, wallpaperValues, zhTypeLabel,
  withSelectedTags,
} from '../utils/tagLibrary'
import { normalizeImportErrors } from '../utils/locales'
import { usePageSelection } from '../utils/pageSelection'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']
const VIDEO_EXTS = ['mp4', 'm4v', 'mov', 'webm']
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
const IMAGE_ACCEPT = IMAGE_EXTS.map((e) => `.${e}`).join(',')
const ASSET_ACCEPT = [...IMAGE_EXTS, ...VIDEO_EXTS].map((e) => `.${e}`).join(',')
const MAX_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_SEC = 15
const panel = ref('list')
const editing = ref(false)
const bulkMode = ref(false)
const rows = ref([])
const page = ref(1)
const total = ref(0)
const summary = ref(null)
const PAGE_SIZE = 50
const q = ref('')
const tagType = ref('all')
const tagName = ref('all')
const requiredTags = ref('all')
const vip = ref('all')
const status = ref('all')
const loading = ref(false)
const types = ref([])
const allTags = ref([])
const uploading = ref(false)
const posterUploading = ref(false)
const assetName = ref('')
const posterName = ref('')
const posterTouched = ref(false)
const assetIsVideo = ref(false)
const assetInput = ref(null)
const form = ref(emptyForm())
const importOpen = ref(false)
const importing = ref(false)
const exporting = ref(false)
const importKind = ref('files')
const importFile = ref(null)
const importErrors = ref([])
const newFiles = ref([])
const importedIds = ref([])
const batchOpen = ref(false)
const batchOp = ref('add')

const wallpaperTypes = computed(() => types.value.filter((t) => typeApplies(t, 'wallpaper')))
const secondaryOpts = computed(() => {
  if (tagType.value === 'all') return []
  return allTags.value
    .filter((t) => t.type === tagType.value)
    .map((t) => ({
      value: `${t.type}::${t.name}`,
      label: t.enabled ? t.name : `${t.name}（已停用）`,
    }))
})
const {
  tableRef, selectedIds, onSelectionChange, restoreSelection, clearSelection, selectIds,
} = usePageSelection(rows)
function requiredCell(row) {
  if (row.required_tags === 'complete') return { missing: [] }
  return { missing: missingRequiredTypes(types.value, 'wallpaper', (key) => wallpaperValues(row, key)) }
}
const customWpTypes = computed(() =>
  types.value.filter((t) => typeApplies(t, 'wallpaper') && !['content', 'theme', 'scenario', 'emotion', 'visual'].includes(t.key)),
)
const footerState = computed(() => {
  if (!form.value.id) return '尚未保存'
  return form.value.status === 1 ? '已启用 · App 正在展示' : '已停用 · App 不展示'
})
const hasFilters = computed(() => !!(
  q.value || tagType.value !== 'all' || tagName.value !== 'all' || status.value !== 'all'
  || requiredTags.value !== 'all' || vip.value !== 'all'
))
const isVideo = computed(() => assetIsVideo.value || form.value.media_type === 'video' || !!form.value.video_url)
const assetImageStyle = computed(() => {
  const url = form.value.image_url
  return url ? { backgroundImage: `url(${url})` } : {}
})
const posterStyle = computed(() => {
  const url = form.value.poster_url
  return url ? { backgroundImage: `url(${url})` } : {}
})

function rowNo(index) {
  return (page.value - 1) * PAGE_SIZE + index + 1
}
function sortById(a, b) {
  return Number(a.id) - Number(b.id)
}
function reqClass(key) {
  return types.value.find((x) => x.key === key)?.required ? 'cms-req' : 'cms-hint'
}
function reqText(key, multi = false) {
  const t = types.value.find((x) => x.key === key)
  if (t?.required) return multi ? '* 必填，可多选' : '*'
  return multi ? '选填，可多选' : '选填'
}
function emptyForm() {
  return {
    image_url: '', media_type: 'static', video_url: '', poster_url: '', duration_sec: null,
    name_en: '', theme: '', visual_tags: [], scenario_tags: [], emotion_tags: [],
    taxonomy: {}, status: 0, app_key: defaultCreateAppKey('selah'),
    is_vip: false, sort_weight: 0,
  }
}
function thumb(row) {
  return (row.media_type === 'video' ? row.poster_url : row.image_url) || row.image_url || ''
}
function fileExt(file) {
  return String(file?.name || '').split('.').pop().toLowerCase()
}
function fileNameFromUrl(url) {
  if (!url) return ''
  try {
    return decodeURIComponent(String(url).split('?')[0].split('/').pop() || '')
  } catch {
    return String(url).split('/').pop() || ''
  }
}
function isImageFile(file) {
  return IMAGE_MIMES.includes(file.type) || IMAGE_EXTS.includes(fileExt(file))
}
function isVideoFile(file) {
  return VIDEO_MIMES.includes(file.type) || VIDEO_EXTS.includes(fileExt(file))
}
function parseUpload(res) {
  const bag = (res && typeof res.results === 'object' && !Array.isArray(res.results) && res.results)
    || res.data
    || {}
  const url = bag.url || (typeof res.results === 'string' ? res.results : '') || ''
  return {
    url,
    kind: String(bag.kind || '').toLowerCase(),
    content_type: bag.content_type || '',
    name: bag.name || '',
  }
}
function inferKind(file, parsed) {
  if (parsed.kind === 'video' || parsed.kind === 'image') return parsed.kind
  const ct = String(parsed.content_type || file.type || '').toLowerCase()
  if (ct.startsWith('video/')) return 'video'
  if (ct.startsWith('image/')) return 'image'
  const hint = `${file.name || ''} ${parsed.name || ''} ${parsed.url || ''}`
  const ext = hint.split('?')[0].split('.').pop().toLowerCase()
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (IMAGE_EXTS.includes(ext)) return 'image'
  return isVideoFile(file) ? 'video' : 'image'
}
function readVideoDuration(url) {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      const sec = Number(el.duration)
      el.src = ''
      resolve(Number.isFinite(sec) ? sec : null)
    }
    el.onerror = () => resolve(null)
    el.src = url
  })
}

function onAssetBoxClick(e) {
  if (e.target.closest('video')) return
  assetInput.value?.click()
}

function validateUploadFile(file, imagesOnly) {
  if (!file) return '请选择文件'
  if (file.size > MAX_BYTES) return '单个文件不能超过 15 MB'
  if (imagesOnly) {
    if (!isImageFile(file)) return '封面只支持图片：JPG、JPEG、PNG、GIF、WebP、AVIF、BMP'
    return ''
  }
  if (!isImageFile(file) && !isVideoFile(file)) {
    return '素材仅支持图片或视频：JPG / PNG / GIF / WebP / AVIF / BMP / MP4 / M4V / MOV / WebM'
  }
  return ''
}

async function uploadWallpaperFile(file) {
  const res = await uploadFile(file, 'selah/wallpapers')
  const parsed = parseUpload(res)
  if (!parsed.url) throw new Error('未返回 URL')
  return parsed
}

async function loadMeta() {
  const [tr, tagsRes] = await Promise.all([
    fetchTagTypes(),
    fetchLibraryTags({ currentPage: 1, pageSize: 500 }),
  ])
  types.value = tr.results || []
  allTags.value = tagsRes.results || []
}

async function load(p = page.value) {
  page.value = p
  const params = { currentPage: page.value, pageSize: PAGE_SIZE, app_key: 'selah' }
  if (panel.value === 'trash') params.trashed = 1
  if (q.value) params.q = q.value
  if (panel.value === 'list' && tagType.value !== 'all') params.tag_type = tagType.value
  if (panel.value === 'list' && tagName.value !== 'all') {
    const [tt, tn] = String(tagName.value).split('::')
    if (tt) params.tag_type = tt
    if (tn) params.tag_name = tn
  }
  if (panel.value === 'list' && status.value !== 'all') params.status = status.value
  if (panel.value === 'list' && requiredTags.value !== 'all') params.required_tags = requiredTags.value
  if (panel.value === 'list' && vip.value === 'vip') params.is_vip = 1
  if (panel.value === 'list' && vip.value === 'free') params.is_vip = 0
  loading.value = true
  try {
    const res = await fetchWallpapers(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
    summary.value = res.meta?.summary || res.summary || null
    if (bulkMode.value) await restoreSelection()
  } finally {
    loading.value = false
  }
}

function onPanelChange() {
  editing.value = false
  bulkMode.value = false
  clearSelection()
  load(1)
}

function onPrimaryChange() {
  tagName.value = 'all'
  load(1)
}

function toggleBulk() {
  bulkMode.value = !bulkMode.value
  clearSelection()
}

function openBatch(op) {
  if (!selectedIds.value.length) return
  batchOp.value = op
  batchOpen.value = true
}

async function applyBatch({ type, names }) {
  if (!selectedIds.value.length || !type || !names?.length) return
  try {
    await bulkWallpaperTags({
      ids: selectedIds.value,
      operation: batchOp.value,
      taxonomy: { [type]: names },
    })
    ElMessage.success(`已为 ${selectedIds.value.length} 张壁纸${batchOp.value === 'add' ? '追加' : '移除'}标签`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '批量失败')
  }
}

function openEditor(row) {
  if (row) {
    const tax = { ...(row.taxonomy || {}) }
    customWpTypes.value.forEach((t) => { if (!tax[t.key]) tax[t.key] = [] })
    form.value = {
      ...emptyForm(),
      id: row.id,
      image_url: row.image_url || '',
      media_type: row.media_type || 'static',
      video_url: row.video_url || '',
      poster_url: row.poster_url || '',
      duration_sec: row.duration_sec,
      name_en: row.name_en || '',
      theme: row.theme || '',
      visual_tags: [...(row.visual_tags || [])],
      scenario_tags: [...(row.scenario_tags || [])],
      emotion_tags: [...(row.emotion_tags || [])],
      taxonomy: tax,
      status: row.status,
      is_vip: !!row.is_vip,
      sort_weight: row.sort_weight || 0,
    }
    assetName.value = row.media_type === 'video'
      ? (fileNameFromUrl(row.video_url) || row.name_en || '已有视频')
      : (fileNameFromUrl(row.image_url) || row.name_en || '已有素材')
    posterName.value = row.media_type === 'video' ? (fileNameFromUrl(row.poster_url) || (row.poster_url ? '已有封面' : '')) : ''
    posterTouched.value = false
    assetIsVideo.value = row.media_type === 'video'
  } else {
    const tax = {}
    customWpTypes.value.forEach((t) => { tax[t.key] = [] })
    form.value = { ...emptyForm(), taxonomy: tax }
    assetName.value = ''
    posterName.value = ''
    posterTouched.value = false
    assetIsVideo.value = false
  }
  editing.value = true
}

async function onAssetFile(e) {
  const raw = e.target.files?.[0]
  e.target.value = ''
  if (!raw) return
  const err = validateUploadFile(raw, false)
  if (err) {
    ElMessage.warning(err)
    return
  }
  if (uploading.value || posterUploading.value) return
  const localVideo = isVideoFile(raw)
  assetName.value = raw.name
  if (localVideo) {
    assetIsVideo.value = true
    form.value = {
      ...form.value,
      media_type: 'video',
      image_url: '',
    }
  }
  uploading.value = true
  try {
    const parsed = await uploadWallpaperFile(raw)
    const kind = localVideo ? 'video' : inferKind(raw, parsed)
    if (kind === 'video') {
      assetIsVideo.value = true
      await applyVideoAsset(parsed.url)
    } else {
      assetIsVideo.value = false
      applyImageAsset(parsed.url)
    }
    ElMessage.success('壁纸素材已上传')
  } catch (err) {
    ElMessage.error(err.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function applyVideoAsset(url) {
  const keepPoster = form.value.media_type === 'video' ? form.value.poster_url : ''
  form.value = {
    ...form.value,
    media_type: 'video',
    video_url: url,
    image_url: '',
    poster_url: keepPoster,
    duration_sec: null,
  }
  const sec = await readVideoDuration(url)
  if (sec && sec <= MAX_VIDEO_SEC) form.value.duration_sec = Math.round(sec)
  if (sec && sec > MAX_VIDEO_SEC) {
    ElMessage.warning('视频超过 15 秒，保存时不会提交时长；请尽量使用 15 秒以内的素材')
  }
  if (!keepPoster) {
    posterName.value = ''
    posterTouched.value = false
  }
}

function applyImageAsset(url) {
  assetIsVideo.value = false
  form.value = {
    ...form.value,
    media_type: 'static',
    image_url: url,
    video_url: '',
    poster_url: '',
    duration_sec: null,
  }
  posterName.value = ''
  posterTouched.value = false
}

async function onPosterFile(e) {
  const raw = e.target.files?.[0]
  e.target.value = ''
  if (!raw) return
  const err = validateUploadFile(raw, true)
  if (err) {
    ElMessage.warning(err)
    return
  }
  if (uploading.value || posterUploading.value) return
  posterUploading.value = true
  try {
    const parsed = await uploadWallpaperFile(raw)
    const kind = inferKind(raw, parsed)
    if (kind !== 'image') {
      ElMessage.warning('封面必须是图片')
      return
    }
    form.value.poster_url = parsed.url
    posterName.value = raw.name
    posterTouched.value = true
    ElMessage.success('壁纸封面已上传')
  } catch (err) {
    ElMessage.error(err.message || '封面上传失败')
  } finally {
    posterUploading.value = false
  }
}

function saveMessage(statusVal) {
  if (statusVal === 1) return '壁纸发布成功！'
  if (form.value.status === 1) return '壁纸停用成功！'
  return '壁纸保存成功！'
}

function mediaPayload() {
  if (form.value.media_type === 'video') {
    const payload = {
      media_type: 'video',
      video_url: form.value.video_url,
    }
    if (posterTouched.value || !form.value.id) payload.poster_url = form.value.poster_url
    if (form.value.duration_sec) payload.duration_sec = form.value.duration_sec
    return payload
  }
  return {
    media_type: 'static',
    image_url: form.value.image_url,
    video_url: '',
    poster_url: '',
    duration_sec: null,
  }
}

async function save(statusVal) {
  if (!String(form.value.name_en || '').trim()) {
    ElMessage.warning('请填写 English 名称')
    return
  }
  if (form.value.media_type === 'video') {
    if (!form.value.video_url) {
      ElMessage.warning('请先上传壁纸素材')
      return
    }
    if (!form.value.poster_url) {
      ElMessage.warning('视频壁纸请上传封面图')
      return
    }
    if (form.value.duration_sec && form.value.duration_sec > MAX_VIDEO_SEC) {
      ElMessage.warning('视频不能超过 15 秒')
      return
    }
  } else if (!form.value.image_url) {
    ElMessage.warning('请先上传壁纸素材')
    return
  }
  if (statusVal === 1) {
    const missing = missingRequiredTypes(types.value, 'wallpaper', (k) => wallpaperValues(form.value, k))
    if (missing.length) {
      ElMessage.warning(`发布前请先选择必填标签：${missing.join('、')}`)
      return
    }
  }
  const rest = { ...form.value }
  delete rest.image_url
  delete rest.video_url
  delete rest.poster_url
  delete rest.media_type
  delete rest.duration_sec
  try {
    await saveWallpaper({
      ...rest,
      ...mediaPayload(),
      app_key: defaultCreateAppKey('selah'),
      platform: '',
      status: statusVal,
    })
    ElMessage.success(saveMessage(statusVal))
    editing.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.poster_url || '保存失败')
  }
}

async function toggleStatus(row) {
  if (row.status === 1) {
    try {
      await saveWallpaper({ id: row.id, status: 0 })
      ElMessage.success('壁纸已停用，App 不再展示')
      load()
    } catch (e) {
      ElMessage.error(e.message || '操作失败')
    }
    return
  }
  if (missingEnglish(row.name_en).length) {
    ElMessage.warning('启用前请完整填写 English 名称')
    return
  }
  if (!row.image_url && !row.video_url) {
    ElMessage.warning('启用前请先上传壁纸素材')
    return
  }
  if (row.media_type === 'video' && !row.poster_url) {
    ElMessage.warning('启用前请先补齐视频封面')
    return
  }
  const missing = missingRequiredTypes(types.value, 'wallpaper', (k) => wallpaperValues(row, k))
  if (missing.length) {
    ElMessage.warning(`启用前请先补充必填标签：${missing.join('、')}`)
    return
  }
  try {
    await saveWallpaper({ id: row.id, status: 1 })
    ElMessage.success('壁纸已启用，App 可以展示')
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function onSoftDelete(row) {
  try {
    await ElMessageBox.confirm('删除后进入回收站，可随时恢复。若只需下架请用「停用」。', '确认删除壁纸', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
  } catch { return }
  try {
    await deleteWallpaper(row.id)
    ElMessage.success('已移入回收站')
    load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function onBulkDelete() {
  if (!selectedIds.value.length) return
  const names = selectedIds.value.slice(0, 8).map((id) => {
    const row = rows.value.find((item) => item.id === id)
    return row?.name_en ? `${row.name_en}（#${id}）` : `#${id}`
  }).join('、')
  try {
    await ElMessageBox.confirm(
      `将删除 ${selectedIds.value.length} 张壁纸：${names}${selectedIds.value.length > 8 ? '…' : ''}。删除后进入回收站，可恢复。若被壁纸合集直接关联，将从合集中移除。`,
      '批量删除壁纸',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch { return }
  try {
    await deleteWallpaper(selectedIds.value)
    ElMessage.success(`已将 ${selectedIds.value.length} 张移入回收站`)
    clearSelection()
    load()
  } catch (e) {
    ElMessage.error(e.message || '批量删除失败')
  }
}

async function onRestore(row) {
  try {
    await restoreWallpaper(row.id)
    ElMessage.success('已恢复')
    load()
  } catch (e) {
    ElMessage.error(e.message || '恢复失败')
  }
}

function onImportFile(file) {
  importFile.value = file?.raw || null
}

function openImport(kind) {
  importKind.value = kind === 'replace' ? 'replace' : 'files'
  importFile.value = null
  importErrors.value = []
  importedIds.value = []
  clearNewThumbs()
  newFiles.value = []
  importOpen.value = true
}

function clearNewThumbs() {
  for (const item of newFiles.value) {
    if (item.thumb) URL.revokeObjectURL(item.thumb)
  }
}

function formatSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function onPickAssets(_file, fileList) {
  clearNewThumbs()
  const files = (fileList || []).map((item) => item.raw).filter(Boolean)
  const tooMany = files.length > 100
  newFiles.value = files.map((file) => {
    const ext = String(file.name || '').split('.').pop().toLowerCase()
    const name = String(file.name || '').replace(/\.[^.]+$/, '').trim()
    let error = ''
    if (tooMany) error = '超过单次 100 个'
    else if (![...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) error = '格式不支持'
    else if (file.size > MAX_BYTES) error = '超过 15 MB'
    else if (!name) error = '文件名为空'
    const thumb = !error && IMAGE_EXTS.includes(ext) ? URL.createObjectURL(file) : ''
    return { file, name, size: file.size, error, thumb, ext }
  })
}

function wallpaperFilterParams() {
  const params = { app_key: 'selah' }
  if (q.value) params.q = q.value
  if (tagType.value !== 'all') params.tag_type = tagType.value
  if (tagName.value !== 'all') {
    const [tt, tn] = String(tagName.value).split('::')
    if (tt) params.tag_type = tt
    if (tn) params.tag_name = tn
  }
  if (status.value !== 'all') params.status = status.value
  if (requiredTags.value !== 'all') params.required_tags = requiredTags.value
  if (vip.value === 'vip') params.is_vip = 1
  if (vip.value === 'free') params.is_vip = 0
  return params
}

async function runExport() {
  exporting.value = true
  try {
    const params = wallpaperFilterParams()
    if (selectedIds.value.length) params.ids = selectedIds.value.join(',')
    await exportWallpapers(params)
    ElMessage.success(selectedIds.value.length ? `已导出所选 ${selectedIds.value.length} 张` : '已导出当前筛选结果')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '导出失败')
  } finally {
    exporting.value = false
  }
}

async function runImport() {
  if (importKind.value === 'files') {
    if (!newFiles.value.length || newFiles.value.some((item) => item.error)) {
      ElMessage.warning('有文件未通过校验，整批不会导入')
      return
    }
    importing.value = true
    const ids = []
    try {
      for (const item of newFiles.value) {
        const uploaded = await uploadWallpaperFile(item.file)
        const isVideo = VIDEO_EXTS.includes(item.ext)
        const res = await saveWallpaper({
          name_en: item.name,
          app_key: defaultCreateAppKey('selah'),
          platform: '',
          status: 0,
          theme: '',
          visual_tags: [],
          scenario_tags: [],
          emotion_tags: [],
          taxonomy: {},
          media_type: isVideo ? 'video' : 'static',
          image_url: isVideo ? '' : uploaded.url,
          video_url: isVideo ? uploaded.url : '',
          poster_url: '',
        })
        const id = res.results?.id || res.results?.wallpaper?.id || res.data?.id
        if (id) ids.push(id)
      }
      importedIds.value = ids
      ElMessage.success(`已导入 ${newFiles.value.length} 个，状态为停用`)
      await load(1)
    } catch (e) {
      ElMessage.error(e.message || '有文件导入失败，整批已中止。已写入的请到列表核对')
    } finally {
      importing.value = false
    }
    return
  }
  if (!importFile.value) {
    ElMessage.warning('请选择要上传的表格')
    return
  }
  importing.value = true
  importErrors.value = []
  try {
    const res = await importWallpapersFile(importFile.value, 'selah', 'replace')
    const data = res.results || res.data || {}
    const errors = normalizeImportErrors(data.errors)
    if (errors.length) {
      importErrors.value = errors
      ElMessage.error(res.message || '有一行校验失败，整张表未导入')
      return
    }
    ElMessage.success('已按壁纸 ID 覆盖')
    importOpen.value = false
    importFile.value = null
    load(1)
  } catch (e) {
    const errors = normalizeImportErrors(e?.results?.errors || e?.errors)
    if (errors.length) {
      importErrors.value = errors
      ElMessage.error(e.message || e.msg || '有一行校验失败，整张表未导入')
    } else {
      ElMessage.error(e.message || e.msg || '导入失败')
    }
  } finally {
    importing.value = false
  }
}

function manageImported() {
  bulkMode.value = true
  selectIds(importedIds.value)
  importOpen.value = false
  load(1)
}

watch(panel, () => { editing.value = false })
let wallpaperSearchTimer
watch(q, () => {
  clearTimeout(wallpaperSearchTimer)
  wallpaperSearchTimer = setTimeout(() => load(1), 200)
})
onMounted(async () => {
  await loadMeta()
  await load(1)
})
</script>

<style scoped>
.wp-list-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px 16px;
  border-bottom: 1px solid var(--pro-border);
  color: var(--pro-text-secondary, #606266);
  font-size: 13px;
}
.wp-miss {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f5222d;
  font-weight: 500;
}
.import-rules {
  margin: 0 0 12px;
  padding-left: 18px;
  color: var(--pro-text-secondary, #606266);
  font-size: 13px;
  line-height: 1.6;
}
.import-thumb {
  width: 40px;
  height: 54px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}
</style>
