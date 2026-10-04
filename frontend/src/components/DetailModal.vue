<script setup>
import { computed, ref } from 'vue'
import { api } from '../api'
import { KIND_KEYS, fmt } from '../constants'
import { visibleFormFields } from '../fields'
import { t } from '../i18n'

const props = defineProps({ item: Object })
const emit = defineEmits(['close', 'edit', 'remove', 'changed'])

const ADDRESS = ['street', 'postal_code', 'city']
const SKIP = ['company', 'position'] // already shown in the heading

const has = (key) => visibleFormFields.value.some((f) => f.key === key)

const address = computed(() => {
  const cityLine = [has('postal_code') && props.item.postal_code, has('city') && props.item.city]
    .filter(Boolean).join(' ')
  return [has('street') && props.item.street, cityLine].filter(Boolean).join('\n') || '–'
})

function value(f) {
  const v = props.item[f.key]
  if (!v) return '–'
  if (f.type === 'date') return fmt(v)
  if (f.type === 'select') return t(`${f.optionsPrefix}.${v}`)
  return v
}

const rows = computed(() => {
  const out = [{
    key: 'favorite',
    label: 'field.favorite',
    value: props.item.is_favorite ? `★ ${t('detail.yes')}` : '–',
  }]
  let addressAdded = false
  for (const f of visibleFormFields.value) {
    if (SKIP.includes(f.key)) continue
    if (ADDRESS.includes(f.key)) {
      if (!addressAdded) out.push({ key: 'address', label: 'field.address', value: address.value, pre: true })
      addressAdded = true
      continue
    }
    const v = value(f)
    const row = { key: f.key, label: f.label, value: v, pre: f.type === 'textarea' }
    if (v !== '–' && f.type === 'email') row.href = `mailto:${v}`
    if (v !== '–' && f.type === 'url') { row.href = v; row.external = true }
    out.push(row)
  }
  return out
})

// Attachments
const kind = ref('cover_letter')
const uploading = ref(false)
const uploadError = ref('')

async function upload(e) {
  const files = [...e.target.files]
  if (!files.length) return
  uploading.value = true
  uploadError.value = ''
  try {
    for (const file of files) await api.upload(props.item.id, file, kind.value)
    emit('changed')
  } catch (err) {
    const known = ['file_type', 'file_size']
    uploadError.value = known.includes(err.message) ? t(`attachment.error.${err.message}`) : err.message
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

async function removeFile(a) {
  if (!confirm(t('attachment.confirmDelete', { name: a.name }))) return
  await api.removeAttachment(a.id)
  emit('changed')
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="dialog detail">
      <h2>{{ item.company }}</h2>
      <p class="sub">{{ item.position || t('detail.noPosition') }} · {{ t('table.nr') }} {{ item.id }}</p>
      <dl>
        <template v-for="r in rows" :key="r.key">
          <dt>{{ t(r.label) }}</dt>
          <dd :class="{ pre: r.pre }">
            <a v-if="r.href" :href="r.href" :target="r.external ? '_blank' : null" rel="noopener">{{ r.value }}</a>
            <template v-else>{{ r.value }}</template>
          </dd>
        </template>
      </dl>

      <h3>{{ t('attachment.title') }}</h3>
      <ul v-if="item.attachments?.length" class="files">
        <li v-for="a in item.attachments" :key="a.id">
          <a :href="a.file" target="_blank" rel="noopener">{{ a.name }}</a>
          <span class="sub">{{ t(`kind.${a.kind}`) }} · {{ fmt(a.uploaded_at) }}</span>
          <button :aria-label="t('btn.delete')" @click="removeFile(a)">×</button>
        </li>
      </ul>
      <p v-else class="sub">{{ t('attachment.none') }}</p>

      <div class="upload">
        <select v-model="kind" :aria-label="t('attachment.title')">
          <option v-for="k in KIND_KEYS" :key="k" :value="k">{{ t(`kind.${k}`) }}</option>
        </select>
        <label class="file-btn">
          {{ uploading ? t('attachment.uploading') : t('attachment.add') }}
          <input
            type="file"
            multiple
            :disabled="uploading"
            accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg"
            @change="upload"
          />
        </label>
      </div>
      <p v-if="uploadError" class="error">{{ uploadError }}</p>

      <div class="buttons">
        <button @click="$emit('remove', item)">{{ t('btn.delete') }}</button>
        <button @click="$emit('edit')">{{ t('btn.edit') }}</button>
        <button class="primary" @click="$emit('close')">{{ t('btn.close') }}</button>
      </div>
    </section>
  </div>
</template>