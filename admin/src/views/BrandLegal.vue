<!--
  品牌与法务：维度打包列表（App×语言×设备）。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="品牌与法务"
      tips="App 优先读这里的外链；空 URL 时回落本机 /legal/<slug>/。正文覆写仅作用于本机法务页。空维=看全部包。"
      :keys="KEYS"
      :defaults="defaults"
      remark="品牌与法务"
      dialog-width="720px"
      :summary-keys="['brand_name', 'support_email']"
    >
      <template #form="{ form }">
        <el-divider content-position="left">品牌</el-divider>
        <el-form-item label="品牌名">
          <el-input v-model="form.brand_name" placeholder="Selah" />
        </el-form-item>
        <el-form-item label="法律主体">
          <el-input v-model="form.legal_entity_name" placeholder="公司法定名称" />
        </el-form-item>
        <el-form-item label="支持邮箱">
          <el-input v-model="form.support_email" placeholder="support@selah.app" />
        </el-form-item>

        <el-divider content-position="left">法务 / 帮助外链</el-divider>
        <el-form-item label="隐私政策 URL">
          <el-input v-model="form.url_privacy" placeholder="空则本机 /legal/privacy/" />
        </el-form-item>
        <el-form-item label="用户条款 URL">
          <el-input v-model="form.url_terms" placeholder="空则本机 /legal/terms/" />
        </el-form-item>
        <el-form-item label="订阅条款 URL">
          <el-input v-model="form.url_subscription" placeholder="空则本机 /legal/subscription/" />
        </el-form-item>
        <el-form-item label="帮助 URL">
          <el-input v-model="form.url_help" placeholder="空则本机 /legal/help/" />
        </el-form-item>
        <el-form-item label="下载落地页">
          <el-input v-model="form.url_download" placeholder="空则本机 /legal/download/" />
        </el-form-item>

        <el-divider content-position="left">社交</el-divider>
        <el-form-item label="Instagram"><el-input v-model="form.url_instagram" /></el-form-item>
        <el-form-item label="TikTok"><el-input v-model="form.url_tiktok" /></el-form-item>
        <el-form-item label="Facebook"><el-input v-model="form.url_facebook" /></el-form-item>

        <el-divider content-position="left">本机法务正文覆写（可选）</el-divider>
        <el-form-item label="Privacy 正文">
          <el-input v-model="form.legal_body_privacy" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="Terms 正文">
          <el-input v-model="form.legal_body_terms" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="Subscription 正文">
          <el-input v-model="form.legal_body_subscription" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Help 正文">
          <el-input v-model="form.legal_body_help" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Download 正文">
          <el-input v-model="form.legal_body_download" type="textarea" :rows="2" />
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'

const defaults = {
  brand_name: 'Selah',
  legal_entity_name: '[Pending legal entity name]',
  support_email: 'support@selah.app',
  url_privacy: '',
  url_terms: '',
  url_subscription: '',
  url_help: '',
  url_download: '',
  url_instagram: '',
  url_tiktok: '',
  url_facebook: '',
  legal_body_privacy: '',
  legal_body_terms: '',
  legal_body_subscription: '',
  legal_body_help: '',
  legal_body_download: '',
}
const KEYS = Object.keys(defaults)
</script>
