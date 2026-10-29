<template>
  <section class="cms-match-preview">
    <div class="cms-match-head">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ copy }}</p>
      </div>
      <span>{{ countText }}</span>
    </div>
    <el-table
      v-if="!wallpaper && items.length"
      :data="items"
      class="allow-wrap cms-match-table"
      row-key="id"
      :row-class-name="({ row }) => (row.status !== 1 ? 'is-disabled' : '')"
    >
      <el-table-column type="index" label="序号" width="72" :index="(i) => i + 1" />
      <el-table-column label="ID" width="96" sortable :sort-method="sortById">
        <template #default="{ row }">
          <span class="cms-id">#{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column label="语录内容" min-width="220">
        <template #default="{ row }">
          <strong>{{ row.title || row.content || '未命名' }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
            {{ row.status === 1 ? '已启用' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标签" min-width="200">
        <template #default="{ row }">
          <div v-if="(row.tags || []).length" class="cms-tag-scroller">
            <span
              v-for="tag in row.tags"
              :key="tag"
              class="cms-sec-tag"
              :class="{ match: (row.matched_tags || []).includes(tag) }"
            >{{ tag }}</span>
          </div>
          <span v-else class="cms-hint">暂未关联二级隐性标签</span>
        </template>
      </el-table-column>
    </el-table>
    <div v-else-if="wallpaper && items.length" class="cms-match-grid wallpaper">
      <article
        v-for="item in items"
        :key="item.id"
        class="cms-match-card"
        :class="{ disabled: item.status !== 1 }"
      >
        <div class="cms-match-thumb" :style="item.thumb ? { backgroundImage: `url(${item.thumb})` } : {}">
          <i v-if="item.vip" class="cms-lock">🔒</i>
        </div>
        <div class="cms-match-body">
          <div class="cms-match-name">
            <div>
              <strong>{{ item.title || item.content }}</strong>
              <small>#{{ item.id }}</small>
            </div>
            <el-tag :type="item.status === 1 ? 'success' : 'info'" size="small">
              {{ item.status === 1 ? '已启用' : '已停用' }}
            </el-tag>
          </div>
          <div v-if="(item.tags || []).length" class="cms-tag-scroller">
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="cms-sec-tag"
              :class="{ match: (item.matched_tags || []).includes(tag) }"
            >{{ tag }}</span>
          </div>
          <span v-else class="cms-hint">暂未关联二级隐性标签</span>
        </div>
      </article>
    </div>
    <div v-else class="cms-empty">{{ empty }}</div>
  </section>
</template>

<script setup>
function sortById(a, b) {
  return Number(a.id) - Number(b.id)
}

defineProps({
  title: { type: String, default: '收录结果预览' },
  copy: { type: String, default: '' },
  countText: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  empty: { type: String, default: '尚未选择' },
  wallpaper: { type: Boolean, default: false },
})
</script>
