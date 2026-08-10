<!--
  AI Provider：维度打包列表；Key 走环境变量。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="AI Provider"
      tips="Provider / 模型 / 系统 Prompt 存运营配置；AI_API_KEY / AI_API_BASE 仅环境变量。空维=看全部包。"
      :keys="KEYS"
      :defaults="defaults"
      remark="AI Provider"
      dialog-width="720px"
      :summary-keys="['ai_provider', 'ai_model', 'vip_daily_quota']"
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
        <el-form-item label="Model">
          <el-select v-model="form.ai_model" filterable allow-create style="width: 100%" placeholder="选择模型">
            <el-option v-for="m in modelOptionsFor(form)" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="Temperature">
          <el-input-number v-model="form.ai_temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="Timeout (s)">
          <el-input-number v-model="form.ai_timeout" :min="5" :max="180" />
        </el-form-item>
        <el-form-item label="VIP 日额度">
          <el-input-number v-model="form.vip_daily_quota" :min="1" :max="1000" />
        </el-form-item>
        <el-form-item label="空态欢迎文案">
          <el-input v-model="form.ai_greeting" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="系统 Prompt">
          <el-input v-model="form.ai_system_prompt" type="textarea" :rows="8" />
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'
import { AI_PROVIDER_ZH, AI_MODEL_OPTIONS } from '../utils/enumZh'

const defaults = {
  ai_provider: 'openai_compatible',
  ai_model: 'gpt-4o-mini',
  ai_temperature: 0.7,
  ai_timeout: 60,
  vip_daily_quota: 100,
  ai_greeting: '',
  ai_system_prompt: '',
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
  return ai.has_key
    ? `已检测到 AI_API_KEY；Base = ${base}`
    : `未检测到 AI_API_KEY，线上将 Mock。Base = ${base}`
}
</script>
