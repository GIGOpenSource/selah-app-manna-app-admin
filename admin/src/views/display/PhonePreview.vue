<template>
  <div class="cms-phone" aria-hidden="true">
    <div class="cms-phone-status"><span>9:41</span><span>Selah</span></div>
    <template v-if="kind === 'quote'">
      <div class="cms-phone-title">Topics you follow</div>
      <template v-if="quoteSections.length">
        <section v-for="sec in quoteSections" :key="sec.id">
          <div class="cms-phone-section">
            <span>{{ sec.name }}</span>
            <small>Follow all</small>
          </div>
          <div class="cms-phone-list">
            <div v-if="!sec.collections.length" class="cms-phone-row muted">No collections</div>
            <div v-for="col in sec.collections" :key="col.id" class="cms-phone-row">
              <span>{{ col.name }}<i v-if="col.vip" class="cms-lock">🔒</i></span>
              <span class="cms-phone-follow">Follow</span>
            </div>
          </div>
        </section>
      </template>
      <div v-else class="cms-phone-empty">No published content</div>
    </template>
    <template v-else>
      <div class="cms-phone-title">Wallpapers</div>
      <div class="cms-phone-filters">
        <button type="button" class="cms-phone-chip" :class="{ active: !activeFilter }" @click="activeFilter = ''">All</button>
        <button
          v-for="tag in filterChips"
          :key="tag.id"
          type="button"
          class="cms-phone-chip"
          :class="{ active: String(activeFilter) === String(tag.id) }"
          @click="activeFilter = String(tag.id)"
        >{{ localizedName(tag, previewLang, 'name') }}</button>
      </div>
      <div class="cms-phone-meta">
        <span>{{ activeFilter ? 'Filtered by tag' : 'Showing published content' }}</span>
        <strong>{{ matchingWallpapers.length }} results</strong>
      </div>
      <template v-if="collectionCards.length">
        <div class="cms-phone-section"><span>Collections</span><small>See all</small></div>
        <div class="cms-phone-wp-cols">
          <div
            v-for="(card, i) in collectionCards.slice(0, 4)"
            :key="card.id"
            class="cms-phone-wp-card"
            :class="{ cool: i % 2 && !card.cover, 'has-cover': !!card.cover }"
            :style="card.cover ? { backgroundImage: `url(${card.cover})` } : {}"
          >
            <div>{{ card.name }}<small>{{ card.count }} wallpaper{{ card.count > 1 ? 's' : '' }}</small></div>
          </div>
        </div>
      </template>
      <div v-if="matchingWallpapers.length" class="cms-phone-section">
        <span>{{ activeFilterName }}</span>
        <small>{{ matchingWallpapers.length }}</small>
      </div>
      <div v-if="matchingWallpapers.length" class="cms-phone-wp-grid">
        <div
          v-for="item in matchingWallpapers.slice(0, 8)"
          :key="item.id"
          class="cms-phone-wp-item"
          :style="item.thumb ? { backgroundImage: `url(${item.thumb})` } : {}"
        >
          <span>{{ item.title }}<i v-if="item.vip" class="cms-lock">🔒</i></span>
        </div>
      </div>
      <div v-else class="cms-phone-empty">No published wallpapers match<br><strong>{{ activeFilterName }}</strong></div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import { localizedName } from '../../utils/locales'

const props = defineProps({
  kind: { type: String, required: true },
  previewLang: { type: String, default: 'en' },
  publishedRows: { type: Array, default: () => [] },
  publishedFilters: { type: Array, default: () => [] },
  wallpaperItems: { type: Array, default: () => [] },
})

const activeFilter = ref('')

const quoteSections = computed(() => {
  const published = (props.publishedRows || []).filter((r) => r.status === 'published')
  return published
    .filter((r) => r.display_type === 'column')
    .sort((a, b) => a.sort - b.sort)
    .map((col) => ({
      id: col.id,
      name: localizedName(col, props.previewLang),
      collections: published
        .filter((r) => r.display_type === 'collection' && Number(r.parent_id) === Number(col.id))
        .sort((a, b) => a.sort - b.sort)
        .map((r) => ({ id: r.id, name: localizedName(r, props.previewLang), vip: !!r.vip })),
    }))
    .filter((sec) => sec.collections.length)
})

const filterChips = computed(() => (props.publishedFilters || []).filter((t) => t.frontend_enabled))
const activeTag = computed(() => filterChips.value.find((t) => String(t.id) === String(activeFilter.value)))
const activeFilterName = computed(() => (
  activeTag.value ? localizedName(activeTag.value, props.previewLang, 'name') : 'For you'
))

function wallpaperMatches(item, tag) {
  if (!tag) return true
  return (item.tags || []).includes(tag.name)
}

function wallpaperMatchesGroup(item, group) {
  if (group.mode === 'manual') return (group.manual_ids || []).map(Number).includes(Number(item.id))
  const conditions = group.conditions || []
  if (!conditions.length) return false
  const hits = conditions.map((c) => (item.tags || []).includes(c.name))
  return group.match === 'all' ? hits.every(Boolean) : hits.some(Boolean)
}

const publishedWallpapers = computed(() => (props.wallpaperItems || []).filter((x) => x.status === 1))
const matchingWallpapers = computed(() => {
  const tag = activeTag.value
  return publishedWallpapers.value.filter((item) => wallpaperMatches(item, tag))
})
const collectionCards = computed(() => {
  const ids = new Set(matchingWallpapers.value.map((x) => x.id))
  return (props.publishedRows || [])
    .filter((r) => r.display_type === 'collection_group' && r.status === 'published')
    .sort((a, b) => a.sort - b.sort)
    .map((group) => ({
      id: group.id,
      name: localizedName(group, props.previewLang),
      cover: group.cover_url || '',
      count: publishedWallpapers.value.filter((item) => ids.has(item.id) && wallpaperMatchesGroup(item, group)).length,
    }))
    .filter((c) => c.count > 0)
})
</script>
