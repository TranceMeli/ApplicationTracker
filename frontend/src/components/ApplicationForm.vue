<script setup>
import { vBackdropClose } from '../backdrop'
import { computed, nextTick, reactive, watch } from 'vue'
import { today } from '../constants'
import { clearDraft } from '../draft'
import { FORM_FIELDS, detailSections, visibleFormFields } from '../fields'
import { t } from '../i18n'
import { normalizeLink } from '../logo'
import { useUnsaved } from '../unsaved'
import { RULES } from '../validate'
import DiscardGuard from './DiscardGuard.vue'
import FormField from './FormField.vue'

const props = defineProps({
  item: Object,
  error: String,
  companies: { type: Array, default: () => [] },
  kinds: { type: Array, default: () => [] }, // types in use, offered as suggestions
}) // item {} = new application
const emit = defineEmits(['save', 'close'])

const KEYS = [...FORM_FIELDS.map((f) => f.key), 'is_favorite']
const defaults = { date: today(), status: 'applied', is_favorite: false }

// Hidden fields stay in the form object, so their saved data is sent back unchanged.
// Only editable fields are copied, not id, attachments or the looked-up coordinates.
const form = reactive(
  Object.fromEntries(KEYS.map((key) => [key, props.item[key] ?? (props.item.id ? '' : defaults[key] ?? '')])),
)

// The type is chosen from a menu that starts empty: the built-in types and the ones already in use.
const kindOptions = computed(() => [...new Set([...props.kinds, ...(form.kind ? [form.kind] : [])])])

// Warns while typing when the company already exists (it can still be saved).
const normalize = (name) => (name || '').replace(/\s+/g, ' ').trim().toLowerCase()
const duplicates = computed(() => {
  const key = normalize(form.company)
  return key ? props.companies.filter((c) => c.id !== props.item.id && normalize(c.company) === key) : []
})

// The fields of the header come first, the rest is grouped like the detail view and folds away.
// A section starts open when it already has data (or a default such as today's date).
const topFields = computed(() => visibleFormFields.value.filter((f) => !f.group))
const filledCount = (fields) => fields.filter((f) => form[f.key] !== '' && form[f.key] !== null && form[f.key] !== undefined).length
const startOpen = new Set(detailSections.value.filter((s) => filledCount(s.fields) > 0).map((s) => s.id)) // fixed at the start, so typing never folds a section
const sections = computed(() =>
  detailSections.value
    .filter((section) => section.fields.length)
    .map((section) => ({
      id: section.id,
      title: section.name || t(`group.${section.id}`),
      fields: section.fields,
      filled: filledCount(section.fields),
      open: startOpen.has(section.id),
    })),
)

// Errors are shown at the field: when it loses the focus and when the form is sent. Typing in a field takes its error away.
const errors = reactive({})
function check(key) {
  const rule = RULES[key]
  errors[key] = rule ? rule(form[key]) : ''
}
for (const key of Object.keys(RULES)) watch(() => form[key], () => (errors[key] = ''))

async function submit() {
  for (const key of Object.keys(RULES)) check(key)
  const first = Object.keys(RULES).find((key) => errors[key])
  if (first) {
    // a field in a folded section is opened first, so the message can be seen
    const input = document.getElementById(`field-${first}`)
    const fold = input?.closest('details')
    if (fold) fold.open = true
    await nextTick()
    input?.focus()
    return
  }
  const data = { ...form, link: normalizeLink(form.link) }
  for (const f of FORM_FIELDS) if (f.type === 'date') data[f.key] = data[f.key] || null
  emit('save', props.item.id, data)
}

// Entries that were not saved are not thrown away by accident: Cancel, Escape and the backdrop ask first.
const initial = JSON.stringify(form)
const { asking, request, keep } = useUnsaved(() => JSON.stringify(form) !== initial, () => emit('close'))
function discard() {
  if (!props.item.id) clearDraft()
  emit('close')
}
</script>

<template>
  <div class="overlay" v-backdrop-close="request">
    <form class="dialog" novalidate @submit.prevent="submit">
      <h2>{{ item.id ? t('form.edit') : t('form.new') }}</h2>

      <FormField v-for="f in topFields" :key="f.key" :f="f" :form="form" :kind-options="kindOptions" :duplicates="duplicates" :errors="errors" @check="check" />

      <details v-for="section in sections" :key="section.id" class="fold" :open="section.open">
        <summary>{{ section.title }}<span class="hint">{{ section.filled }} / {{ section.fields.length }}</span></summary>
        <div class="fold-body">
          <FormField v-for="f in section.fields" :key="f.key" :f="f" :form="form" :kind-options="kindOptions" :duplicates="duplicates" :errors="errors" @check="check" />
        </div>
      </details>

      <label class="wide check"><input v-model="form.is_favorite" type="checkbox" /> {{ t('field.favoriteMark') }}</label>
      <p v-if="error" class="error wide">{{ error }}</p>
      <div class="buttons">
        <button type="button" @click="request">{{ t('btn.cancel') }}</button>
        <button class="primary" type="submit">{{ t('btn.save') }}</button>
      </div>
      <DiscardGuard v-if="asking" @keep="keep" @discard="discard" />
    </form>
  </div>
</template>