<!--
  AI Provider：系统 Prompt、模型、API Base/Key 都走运营配置包。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="AI Provider"
      tips="系统 Prompt、模型与 API 都在配置包里。Key 只存服务端，列表里显示掩码；留空则沿用已保存值或环境变量。快捷开场在「快捷开场」页（输入框上方）。对话中的追问在气泡下方，其中一条固定推荐经文。"
      :keys="KEYS"
      :defaults="defaults"
      :secret-keys="['ai_api_key']"
      remark="AI Provider"
      dialog-width="760px"
      label-width="150px"
      :summary-keys="['ai_provider', 'ai_model', 'ai_api_base']"
      :meta-hint-fn="metaHintFn"
    >
      <template #form="{ form }">
        <el-form-item label="Provider">
          <el-select v-model="form.ai_provider" style="width: 100%">
            <el-option
              v-for="(zh, val) in AI_PROVIDER_ZH"
              :key="val"
              :label="`${zh}（${val}）`"
              :value="val"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="API Base">
          <el-input
            v-model="form.ai_api_base"
            placeholder="https://openrouter.ai/api/v1 或 https://api.openai.com/v1"
          />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="form.ai_api_key"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="留空或保持掩码则不修改"
          />
        </el-form-item>
        <el-form-item label="Model">
          <el-select v-model="form.ai_model" filterable allow-create style="width: 100%" placeholder="选择或输入模型">
            <el-option v-for="m in modelOptionsFor(form)" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="HTTP-Referer">
          <el-input v-model="form.ai_http_referer" placeholder="OpenRouter 用，如 https://www.test-selahbible.site" />
        </el-form-item>
        <el-form-item label="X-Title">
          <el-input v-model="form.ai_http_title" placeholder="OpenRouter 应用名，默认 Selah" />
        </el-form-item>
        <el-form-item label="Temperature">
          <el-input-number v-model="form.ai_temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="Timeout (s)">
          <el-input-number v-model="form.ai_timeout" :min="5" :max="180" />
        </el-form-item>
        <el-form-item label="Max tokens">
          <el-input-number v-model="form.ai_max_tokens" :min="128" :max="4096" :step="128" />
        </el-form-item>
        <el-form-item label="VIP 日额度">
          <el-input-number v-model="form.vip_daily_quota" :min="1" :max="1000" />
        </el-form-item>
        <el-form-item label="空态欢迎文案">
          <el-input v-model="form.ai_greeting" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="系统 Prompt">
          <el-input
            v-model="form.ai_system_prompt"
            type="textarea"
            :rows="8"
            placeholder="人设与边界。按语言建配置包；服务端会再追加回复语言、经文格式和快捷追问协议。"
          />
        </el-form-item>
        <el-form-item label="对话快捷追问">
          <el-switch v-model="form.ai_suggest_enabled" />
          <div class="form-hint">每次回复后在气泡下出 3 条下一句（含 1 条推荐经文）；格式指令由服务端注入，不必写进 Prompt。</div>
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'
import { AI_PROVIDER_ZH, AI_MODEL_OPTIONS } from '../utils/enumZh'

const DEFAULT_PROMPT = [
  'You are Selah, a gentle Christian spiritual companion. ',
  'Offer prayerful encouragement, short prayers, and Scripture when it helps. ',
  'Keep replies warm, concise, and pastoral. ',
  'Do not give medical prescriptions, doctrinal condemnation, hate, or self-harm guidance. ',
  'If the user is in crisis, encourage seeking local help.',
].join('')

const defaults = {
  ai_provider: 'openai_compatible',
  ai_api_base: 'https://openrouter.ai/api/v1',
  ai_api_key: '',
  ai_model: 'openai/gpt-4o',
  ai_http_referer: '',
  ai_http_title: 'Selah',
  ai_temperature: 0.7,
  ai_timeout: 60,
  ai_max_tokens: 1024,
  vip_daily_quota: 100,
  ai_greeting: '',
  ai_system_prompt: DEFAULT_PROMPT,
  ai_suggest_enabled: true,
}
const KEYS = Object.keys(defaults)

function modelOptionsFor(form) {
  const cur = form?.ai_model
  const list = [...AI_MODEL_OPTIONS]
  if (cur && !list.includes(cur)) list.unshift(cur)
  return list
}

function metaHintFn(meta) {
  const ai = meta?.ai || {}
  const base = ai.api_base || 'https://api.openai.com/v1'
  if (!ai.has_key) {
    return `未检测到 API Key（后台配置或环境变量）。当前 Base = ${base}；未配 Key 且非 Mock 时对话会失败。`
  }
  const src = ai.key_source === 'config' ? '后台配置' : ai.key_source === 'env' ? '环境变量' : '已配置'
  return `API Key 来自${src}；Base = ${base}`
}
</script>

<style scoped>
.form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
}
</style>
