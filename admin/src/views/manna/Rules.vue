<!--
  Manna 规则：维度打包列表。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="Manna 规则"
      tips="Manna 经济与品牌开关。建议新建时 App 选 manna；空维=看全部包。"
      :keys="KEYS"
      :defaults="defaults"
      remark="Manna 规则"
      dialog-width="680px"
      :summary-keys="['brand_name', 'manna_newcomer_grant', 'manna_features_enabled']"
    >
      <template #form="{ form }">
        <el-form-item label="品牌名"><el-input v-model="form.brand_name" /></el-form-item>
        <el-form-item label="功能总开关"><el-switch v-model="form.manna_features_enabled" /></el-form-item>
        <el-form-item label="新人赠送 Manna">
          <el-input-number v-model="form.manna_newcomer_grant" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="测验通关奖励">
          <el-input-number v-model="form.manna_quiz_pass_reward" :min="0" />
        </el-form-item>
        <el-form-item label="测验失败扣减">
          <el-input-number v-model="form.manna_quiz_fail_penalty" :min="0" />
        </el-form-item>
        <el-form-item label="VIP 开关"><el-switch v-model="form.manna_vip_enabled" /></el-form-item>
        <el-form-item label="VerseCard 品牌"><el-input v-model="form.versecard_brand" /></el-form-item>
        <el-form-item label="分享文案模板">
          <el-input v-model="form.share_text_template" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Home 嵌入测验奖励">
          <el-input-number v-model="form.home_embed_quiz_manna_reward" :min="0" />
        </el-form-item>
        <el-form-item label="成长卡开关"><el-switch v-model="form.stats_card_enabled" /></el-form-item>
        <el-form-item label="支持邮箱"><el-input v-model="form.support_email" /></el-form-item>
        <el-form-item label="Privacy URL"><el-input v-model="form.url_privacy" /></el-form-item>
        <el-form-item label="Terms URL"><el-input v-model="form.url_terms" /></el-form-item>
        <el-form-item label="Help URL"><el-input v-model="form.url_help" /></el-form-item>
        <el-form-item label="Download URL"><el-input v-model="form.url_download" /></el-form-item>
        <el-form-item label="Subscription URL"><el-input v-model="form.url_subscription" /></el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../../components/ConfigPackList.vue'

const defaults = {
  brand_name: 'Manna',
  manna_features_enabled: true,
  manna_newcomer_grant: 200,
  manna_quiz_pass_reward: 30,
  manna_quiz_fail_penalty: 10,
  manna_vip_enabled: false,
  versecard_brand: 'MANNA-DAILY BIBLE',
  share_text_template: '{text} — {reference} · {brand}',
  home_embed_quiz_manna_reward: 0,
  stats_card_enabled: true,
  support_email: 'support@manna.app',
  url_privacy: '',
  url_terms: '',
  url_help: '',
  url_download: '',
  url_subscription: '',
}
const KEYS = Object.keys(defaults)
</script>
