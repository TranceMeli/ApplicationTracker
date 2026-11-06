<script setup>
import { computed } from 'vue'
import { STATUS_KEYS } from '../constants'
import { t } from '../i18n'
import { kindClass, kindName, knownKinds } from '../kind'

const props = defineProps({ stats: Object, total: Number, showGroup: Boolean })
const kinds = computed(() => knownKinds(props.stats.by_kind))
const NONE = '__none__' // the server lists the applications without a type for this value
const withoutKind = computed(() => props.stats.by_kind?.[''] || 0)
const search = defineModel('search')
const status = defineModel('status')
const favorite = defineModel('favorite')
const tag = defineModel('tag')
const kind = defineModel('kind')
const group = defineModel('group')
</script>

<template>
  <nav class="filters">
    <div class="chips">
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
    <button :class="{ active: favorite }" @click="favorite = !favorite">{{ t('filter.favorites') }}</button>
    <span class="chip-sep" aria-hidden="true"></span>
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
    >
      <span class="kind-dot" aria-hidden="true"></span>
      {{ t('filter.noKind') }} {{ withoutKind }}
    </button>
    <button v-if="showGroup" :class="{ active: group }" :aria-pressed="group" @click="group = !group">{{ t('filter.group') }}</button>
    </div>
    <select v-if="Object.keys(stats.tags || {}).length" v-model="tag" class="tag-filter" :aria-label="t('filter.tag')">
      <option value="">{{ t('filter.tag') }}</option>
      <option v-for="(n, name) in stats.tags" :key="name" :value="name">{{ name }} ({{ n }})</option>
    </select>
    <input v-model="search" type="search" :placeholder="t('filter.search')" />
  </nav>
</template>