<script setup>
import { computed, ref } from 'vue'
import { api } from '../api'
import { STATUS_KEYS } from '../constants'
import { FIELDS } from '../fields'
import { downloadTemplate } from '../exporter'
import { t } from '../i18n'

const emit = defineEmits(['close', 'done'])

const FILE_CODES = ['no_file', 'file_type', 'file_size', 'unreadable', 'empty', 'no_company_column']

const file = ref(null)
const defaultStatus = ref('planned')
const mode = ref('update') // 'update' = add new and update existing, 'new_only' = only add new
const result = ref(null)
const error = ref('')
const busy = ref(false)
const done = ref(false)

const canImport = computed(
  () => (result.value?.created > 0 || result.value?.updated > 0) && !busy.value && !done.value,
)

// The favorite flag is called "favorite" in the file columns and "is_favorite" in the data.
const fieldLabel = (key) =>
  t(['favorite', 'is_favorite'].includes(key) ? 'field.favorite' : (FIELDS.find((f) => f.key === key)?.label ?? key))

const recognized = computed(() => (result.value?.columns ?? []).map(fieldLabel).join(', '))
const preview = computed(() =>
  (result.value?.preview ?? []).map((p) => [p.company, p.position, p.city].filter(Boolean).join(' · ')),
)
const updatePreview = computed(() =>
  (result.value?.update_preview ?? []).map((u) => `${u.company}: ${u.fields.map(fieldLabel).join(', ')}`),
)
const problems = computed(() =>
  [...(result.value?.errors ?? []), ...(result.value?.warnings ?? [])]
    .slice(0, 10)
    .map((p) => `${t('import.row', { n: p.row })}: ${t(`import.code.${p.code}`, { value: p.value ?? '' })}`),
)

async function run(dry) {
  busy.value = true
  error.value = ''
  try {
    result.value = await api.importList(file.value, dry, defaultStatus.value, mode.value)
    if (!dry) {
      done.value = true
      emit('done')
    }
  } catch (e) {
    result.value = null
    error.value = FILE_CODES.includes(e.message) ? t(`import.code.${e.message}`) : e.message
  } finally {
    busy.value = false
  }
}

function pick(e) {
  file.value = e.target.files[0] ?? null
  result.value = null
  done.value = false
  if (file.value) run(true) // dry run first: preview without saving
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="dialog import">
      <h2>{{ t('import.title') }}</h2>
      <p class="sub wide">{{ t('import.hint') }}</p>

      <label class="wide">{{ t('import.defaultStatus') }}
        <select v-model="defaultStatus">
          <option v-for="k in STATUS_KEYS" :key="k" :value="k">{{ t(`status.${k}`) }}</option>
        </select>
      </label>

      <fieldset class="wide mode">
        <legend>{{ t('import.modeLabel') }}</legend>
        <label v-for="m in ['update', 'new_only']" :key="m">
          <input
            v-model="mode"
            type="radio"
            :value="m"
            :disabled="busy || done"
            @change="file && run(true)"
          />
          {{ t(m === 'update' ? 'import.modeUpdate' : 'import.modeNew') }}
        </label>
      </fieldset>

      <div class="wide import-actions">
        <label class="file-btn">
          {{ file ? file.name : t('import.choose') }}
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xlsm,.ods,.json"
            :disabled="busy || done"
            @change="pick"
          />
        </label>
        <button type="button" @click="downloadTemplate">{{ t('import.template') }}</button>
      </div>

      <p v-if="error" class="error wide">{{ error }}</p>

      <div v-if="result" class="wide summary">
        <p>
          <strong>{{ t(done ? 'import.created' : 'import.willCreate', { n: result.created }) }}</strong>
          · <strong>{{ t(done ? 'import.updated' : 'import.willUpdate', { n: result.updated }) }}</strong>
          <template v-if="result.unchanged"> · {{ t('import.unchanged', { n: result.unchanged }) }}</template>
          <template v-if="result.skipped"> · {{ t('import.skipped', { n: result.skipped }) }}</template>
          <template v-if="result.duplicates"> · {{ t('import.duplicates', { n: result.duplicates }) }}</template>
          <template v-if="result.errors.length"> · {{ t('import.errors', { n: result.errors.length }) }}</template>
        </p>
        <p class="sub">{{ t('import.recognized') }}: {{ recognized }}</p>
        <p v-if="result.ignored_columns.length" class="sub">
          {{ t('import.ignored') }}: {{ result.ignored_columns.join(', ') }}
        </p>
        <ul v-if="preview.length" class="problems"><li v-for="p in preview" :key="p">{{ p }}</li></ul>
        <ul v-if="updatePreview.length" class="problems"><li v-for="p in updatePreview" :key="p">{{ p }}</li></ul>
        <ul v-if="problems.length" class="problems"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
      </div>

      <div class="buttons">
        <button type="button" @click="$emit('close')">{{ done ? t('btn.close') : t('btn.cancel') }}</button>
        <button v-if="!done" class="primary" :disabled="!canImport" @click="run(false)">
          {{ t('import.run') }}
        </button>
      </div>
    </section>
  </div>
</template>