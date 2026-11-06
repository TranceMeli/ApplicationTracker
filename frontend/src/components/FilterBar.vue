<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { STATUS_KEYS } from '../constants'
import { t } from '../i18n'
import { kindClass, kindName, knownKinds } from '../kind'
import MenuButton from './MenuButton.vue'

const props = defineProps({ stats: Object, total: Number, showGroup: Boolean })
const search = defineModel('search')
const status = defineModel('status')
const favorite = defineModel('favorite')
const tag = defineModel('tag')
const kind = defineModel('kind')
const group = defineModel('group')
const due = defineModel('due')

const NONE = '__none__' // the server lists the applications without a type for this value
const kinds = computed(() => knownKinds(props.stats.by_kind))
const withoutKind = computed(() => props.stats.by_kind?.[''] || 0)
const tagNames = computed(() => Object.keys(props.stats.tags || {}))
const dueCount = computed(() => props.stats.due?.length || 0)

const kindText = (key) => (key === NONE ? t('filter.noKind') : kindName(key))

// The filters in the menu stay visible as removable chips below the bar.
const activeChips = computed(() =>
  [
    kind.value && { key: 'kind', text: t('filter.activeKind', { name: kindText(kind.value) }), clear: () => (kind.value = '') },
    tag.value && { key: 'tag', text: t('filter.activeTag', { name: tag.value }), clear: () => (tag.value = '') },
    favorite.value && { key: 'favorite', text: t('filter.favoritesOnly'), clear: () => (favorite.value = false) },
    due.value && { key: 'due', text: t('filter.dueOnly'), clear: () => (due.value = false) },
  ].filter(Boolean),
)

function reset() {
  search.value = ''
  status.value = ''
  favorite.value = false
  tag.value = ''
  kind.value = ''
  due.value = false
}

// The slash key jumps to the search field, unless a field or a dialog has the focus already.
const searchInput = ref(null)
function onKey(e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) return
  if (document.querySelector('.overlay')) return
  e.preventDefault()
  searchInput.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <nav class="filters" :aria-label="t('filter.menu')">
    <div class="toolbar-row">
      <input
        ref="searchInput"
        v-model="search"
        type="search"
        class="search"
        :placeholder="`${t('filter.search')} (/)`"
        :aria-label="t('filter.search')"
      />

      <div class="chips" role="group" :aria-label="t('field.status')">
        <button :class="{ active: !status }" @click="status = ''">{{ t('filter.all') }} {{ total }}</button>
        <button
          v-for="key in STATUS_KEYS"
          :key="key"
          :class="{ active: status === key }"
          @click="status = status === key ? '' : key"
        >
          <span class="swatch" :class="key" aria-hidden="true"></span>
          {{ t(`status.${key}`) }} {{ stats.by_status?.[key] || 0 }}
        </button>
      </div>

      <MenuButton panel-class="filter-panel" trigger-class="filter-trigger" align="right">
        <template #label>
          {{ t('filter.menu') }}<span v-if="activeChips.length" class="count">{{ activeChips.length }}</span>
        </template>

        <div class="filter-section">
          <h5>{{ t('filter.type') }}</h5>
          <div class="seg">
            <button
              v-for="k in kinds"
              :key="k.key"
              :class="{ active: kind === k.key }"
              :aria-pressed="kind === k.key"
              @click="kind = kind === k.key ? '' : k.key"
            >
              <span class="kind-dot" :class="kindClass(k.key)" aria-hidden="true"></span>
              {{ kindName(k.key) }} {{ k.n }}
            </button>
            <button
              v-if="withoutKind || kind === NONE"
              :class="{ active: kind === NONE }"
              :aria-pressed="kind === NONE"
              @click="kind = kind === NONE ? '' : NONE"
            >{{ t('filter.noKind') }} {{ withoutKind }}</button>
          </div>
        </div>

        <div v-if="tagNames.length" class="filter-section">
          <h5>{{ t('filter.tags') }}</h5>
          <div class="seg tag-list">
            <button
              v-for="name in tagNames"
              :key="name"
              :class="{ active: tag === name }"
              :aria-pressed="tag === name"
              @click="tag = tag === name ? '' : name"
            >{{ name }} {{ stats.tags[name] }}</button>
          </div>
        </div>

        <div class="filter-section">
          <h5>{{ t('filter.more') }}</h5>
          <label class="check"><input v-model="favorite" type="checkbox" /> {{ t('filter.favoritesOnly') }}</label>
          <label class="check">
            <input v-model="due" type="checkbox" :disabled="!dueCount && !due" />
            {{ t('filter.dueOnly') }} <span class="sub">({{ dueCount }})</span>
          </label>
        </div>

        <div v-if="showGroup" class="filter-section">
          <h5>{{ t('filter.display') }}</h5>
          <label class="check"><input v-model="group" type="checkbox" /> {{ t('filter.group') }}</label>
        </div>
      </MenuButton>
    </div>

    <div v-if="activeChips.length" class="active-filters">
      <span v-for="chip in activeChips" :key="chip.key" class="filter-chip">
        {{ chip.text }}
        <button :aria-label="t('filter.remove', { name: chip.text })" @click="chip.clear">✕</button>
      </span>
      <button class="link" @click="reset">{{ t('filter.reset') }}</button>
    </div>
  </nav>
</template>
