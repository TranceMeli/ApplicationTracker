<script setup>
import { STATUS_KEYS } from '../constants'
import { t } from '../i18n'

defineProps({ stats: Object, total: Number })
const search = defineModel('search')
const status = defineModel('status')
const favorite = defineModel('favorite')
</script>

<template>
  <nav class="filters">
    <button :class="{ active: !status }" @click="status = ''">{{ t('filter.all') }} {{ total }}</button>
    <button
      v-for="key in STATUS_KEYS"
      :key="key"
      :class="{ active: status === key }"
      @click="status = status === key ? '' : key"
    >
      {{ t(`status.${key}`) }} {{ stats[key] || 0 }}
    </button>
    <button :class="{ active: favorite }" @click="favorite = !favorite">{{ t('filter.favorites') }}</button>
    <input v-model="search" type="search" :placeholder="t('filter.search')" />
  </nav>
</template>