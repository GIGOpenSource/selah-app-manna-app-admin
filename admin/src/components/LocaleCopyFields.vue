<template>
  <div class="locale-copy">
    <template v-if="variant === 'form'">
      <el-form-item required :label="enLabel">
        <el-input
          :model-value="en"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="enPlaceholder"
          @update:model-value="emit('update:en', $event)"
        />
      </el-form-item>
      <el-form-item :label="esLabel">
        <el-input
          :model-value="es"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="esPlaceholder"
          @update:model-value="emit('update:es', $event)"
        />
      </el-form-item>
      <el-form-item :label="ptLabel">
        <el-input
          :model-value="pt"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="ptPlaceholder"
          @update:model-value="emit('update:pt', $event)"
        />
      </el-form-item>
      <el-form-item v-if="showPreview" label="机翻预览">
        <el-button :loading="previewing" @click="preview">预览机翻</el-button>
      </el-form-item>
      <el-form-item label=" ">
        <div class="cms-hint" style="margin-top: 0">{{ hint }}</div>
      </el-form-item>
    </template>
    <template v-else>
      <div class="locale-field">
        <label class="cms-field-label">{{ enLabel }} <span class="cms-req">*</span></label>
        <el-input
          :model-value="en"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="enPlaceholder"
          @update:model-value="emit('update:en', $event)"
        />
      </div>
      <div class="locale-field">
        <label class="cms-field-label">{{ esLabel }}</label>
        <el-input
          :model-value="es"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="esPlaceholder"
          @update:model-value="emit('update:es', $event)"
        />
      </div>
      <div class="locale-field">
        <label class="cms-field-label">{{ ptLabel }}</label>
        <el-input
          :model-value="pt"
          :type="textarea ? 'textarea' : 'text'"
          :rows="rows"
          :placeholder="ptPlaceholder"
          @update:model-value="emit('update:pt', $event)"
        />
      </div>
      <div class="locale-copy-actions">
        <el-button v-if="showPreview" :loading="previewing" @click="preview">预览机翻</el-button>
        <span class="cms-hint">{{ hint }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { previewTranslate } from '../api'

const props = defineProps({
  en: { type: String, default: '' },
  es: { type: String, default: '' },
  pt: { type: String, default: '' },
  enLabel: { type: String, default: 'English' },
  esLabel: { type: String, default: 'Español' },
  ptLabel: { type: String, default: 'Português' },
  enPlaceholder: { type: String, default: '' },
  esPlaceholder: { type: String, default: '留空则保存时机翻' },
  ptPlaceholder: { type: String, default: '留空则保存时机翻' },
  textarea: { type: Boolean, default: false },
  rows: { type: Number, default: 3 },
  variant: { type: String, default: 'grid' },
  showPreview: { type: Boolean, default: false },
  hint: {
    type: String,
    default: '西语、葡语留空时，保存会按英文机翻补上；已填写的文案会保留，可再人工覆盖。',
  },
})

const emit = defineEmits(['update:en', 'update:es', 'update:pt'])
const previewing = ref(false)

function textOf(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return value.text || value.content || value.value || ''
  return ''
}

async function preview() {
  const text = String(props.en || '').trim()
  if (!text) {
    ElMessage.warning('请先填写 English')
    return
  }
  const targets = []
  if (!String(props.es || '').trim()) targets.push('es')
  if (!String(props.pt || '').trim()) targets.push('pt')
  if (!targets.length) {
    ElMessage.info('西语和葡语已有文案。清空对应输入框后，可以重新预览机翻')
    return
  }
  previewing.value = true
  try {
    const res = await previewTranslate({ texts: [text], source: 'en', targets })
    const items = res.results?.items || res.data?.items || []
    const translations = items[0]?.translations || {}
    const es = textOf(translations.es)
    const pt = textOf(translations.pt)
    if (targets.includes('es') && es) emit('update:es', es)
    if (targets.includes('pt') && pt) emit('update:pt', pt)
    if ((targets.includes('es') && !es) || (targets.includes('pt') && !pt)) {
      ElMessage.warning('有语种没有返回译文，可稍后在保存时再试')
    } else {
      ElMessage.success('已填入空缺译文，保存前还可以修改')
    }
  } catch (e) {
    ElMessage.error(e.message || e.msg || '预览失败')
  } finally {
    previewing.value = false
  }
}
</script>

<style scoped>
.locale-field + .locale-field {
  margin-top: 14px;
}
.locale-copy-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.locale-copy-actions .cms-hint {
  margin-top: 0;
}
</style>
