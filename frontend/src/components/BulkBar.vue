<script setup>
import { computed, ref } from 'vue'
import { STATUS_KEYS } from '../constants'
import { t } from '../i18n'
import { kindName } from '../kind'

const props = defineProps({ count: Number, kinds: { type: Array, default: () => [] } })
const emit = defineEmits(['status', 'kind', 'delete', 'clear'])

const CLEAR = '__clear__'
const status = ref('')
const kind = ref('')
const kindKeys = computed(() => [...new Set(props.kinds)])

function change() {
  if (!status.value) return
  emit('status', status.value)
  status.value = ''
}

// An empty type means "no type", the first option of the menu is only its label.
function changeKind() {
  if (!kind.value) return
  emit('kind', kind.value === CLEAR ? '' : kind.value)
  kind.value = ''
}
</script>

<template>
  <div class="bulk-bar" role="region" :aria-label="t('bulk.selected', { n: count })">
    <strong>{{ t('bulk.selected', { n: count }) }}</strong>
    <select v-model="status" :aria-label="t('bulk.status')" @change="change">
      <option value="">{{ t('bulk.status') }}</option>
      <option v-for="key in STATUS_KEYS" :key="key" :value="key">{{ t(`status.${key}`) }}</option>
    </select>
    <select v-model="kind" :aria-label="t('bulk.kind')" @change="changeKind">
      <option value="">{{ t('bulk.kind') }}</option>
      <option v-for="key in kindKeys" :key="key" :value="key">{{ kindName(key) }}</option>
      <option :value="CLEAR">{{ t('bulk.kindClear') }}</option>
    </select>
    <button class="danger" @click="$emit('delete')">{{ t('btn.delete') }}</button>
    <button @click="$emit('clear')">{{ t('bulk.clear') }}</button>
  </div>
</template>
