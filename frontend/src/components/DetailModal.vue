<script setup>
import { vBackdropClose } from '../backdrop'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { api } from '../api'
import { KIND_KEYS, STATUS_KEYS, fmt, isDue, today } from '../constants'
import { detailSections, settings } from '../fields'
import { locale, t } from '../i18n'
import { askConfirm } from '../confirm'
import { kindClass, kindName } from '../kind'
import CompanyLogo from './CompanyLogo.vue'
import Icon from './Icon.vue'

const props = defineProps({
  item: Object,
  number: Number,
  index: { type: Number, default: -1 }, // position in the list that is shown, for the arrows
  count: { type: Number, default: 0 },
  kinds: { type: Array, default: () => [] }, // types in use
})
const emit = defineEmits(['close', 'edit', 'remove', 'changed', 'status', 'kind', 'update', 'prev', 'next', 'duplicate', 'favorite'])

const ADDRESS = ['street', 'postal_code', 'city']

// ---------- the sections of the overview ----------
const display = (f, raw) => {
  if (f.type === 'date') return fmt(raw)
  if (f.type === 'select') return t(`${f.optionsPrefix}.${raw}`)
  return String(raw)
}

function rowsOf(section) {
  const rows = []
  let addressDone = false
  for (const f of section.fields) {
    if (ADDRESS.includes(f.key)) {
      if (addressDone) continue
      addressDone = true
      const parts = section.fields.filter((x) => ADDRESS.includes(x.key))
      const has = (key) => parts.some((x) => x.key === key)
      const cityLine = [has('postal_code') && props.item.postal_code, has('city') && props.item.city].filter(Boolean).join(' ')
      const text = [has('street') && props.item.street, cityLine].filter(Boolean).join('\n')
      rows.push({ key: 'address', label: 'field.address', fields: parts, value: text, empty: !text, pre: true })
      continue
    }
    const raw = props.item[f.key]
    const empty = raw === null || raw === undefined || raw === ''
    const row = { key: f.key, label: f.label, fields: [f], value: empty ? '' : display(f, raw), empty, pre: f.type === 'textarea' }
    if (!empty && f.type === 'email') row.href = `mailto:${raw}`
    if (!empty && f.type === 'tel') row.href = `tel:${raw}`
    if (!empty && f.type === 'url') { row.href = raw; row.external = true }
    rows.push(row)
  }
  return rows
}

const edit = ref(null) // { key, fields, draft } while a field is being changed
const sections = computed(() => detailSections.value.map((s) => ({ id: s.id, name: s.name, rows: rowsOf(s) })))

// Empty fields are left out of the sections and offered as "+ field", unless one of them is being filled in.
const shownSections = computed(() =>
  sections.value
    .map((s) => ({ ...s, rows: settings.hideEmpty ? s.rows.filter((r) => !r.empty || edit.value?.key === r.key) : s.rows }))
    .filter((s) => s.rows.length),
)
const hiddenRows = computed(() =>
  settings.hideEmpty ? sections.value.flatMap((s) => s.rows.filter((r) => r.empty && edit.value?.key !== r.key)) : [],
)
const sectionTitle = (s) => s.name || t(`group.${s.id}`)

// ---------- changing a field in place ----------
function startEdit(row) {
  const draft = {}
  for (const f of row.fields) draft[f.key] = props.item[f.key] ?? ''
  edit.value = { key: row.key, fields: row.fields, draft }
  nextTick(() => document.querySelector('.detail .editor input, .detail .editor select, .detail .editor textarea')?.focus())
}

const cancelEdit = () => { edit.value = null }

function saveEdit() {
  if (!edit.value) return
  const { fields, draft } = edit.value
  const patch = {}
  for (const f of fields) {
    const before = props.item[f.key] ?? ''
    const after = draft[f.key] ?? ''
    if (String(after) !== String(before)) patch[f.key] = f.type === 'date' && !after ? null : after
  }
  edit.value = null
  if (Object.keys(patch).length) emit('update', props.item, patch)
}

watch(() => props.item.id, () => { edit.value = null })

// ---------- header: status, type, next date, quick actions ----------
const kindOptions = computed(() => [...new Set([...props.kinds, ...(props.item.kind ? [props.item.kind] : [])])])

const nextDate = computed(() => {
  const item = props.item
  if (item.follow_up && item.status === 'applied') {
    return { text: t('detail.followUp', { date: fmt(item.follow_up) }), due: isDue(item) }
  }
  if (item.interview_date && item.interview_date >= today() && item.status !== 'rejected') {
    return { text: t('detail.interviewOn', { date: fmt(item.interview_date) }), due: false }
  }
  return null
})

const subtitle = computed(() =>
  [props.item.position || t('detail.noPosition'), `${t('table.nr')} ${props.number || props.item.id}`, props.item.city]
    .filter(Boolean)
    .join(' · '),
)

// ---------- the way through the process ----------
const STEPS = ['planned', 'applied', 'interview', 'offer']
const short = (d) => {
  if (!d) return ''
  const [, month, day] = d.slice(0, 10).split('-')
  return `${Number(day)}.${Number(month)}.`
}

function stepDate(key) {
  const item = props.item
  const fromFields = { applied: item.date, interview: item.interview_date, offer: item.response_date, rejected: item.response_date }[key]
  if (fromFields) return short(fromFields)
  const event = [...(item.events ?? [])].reverse().find((e) => e.kind !== 'note' && e.status === key)
  return event ? short(event.date) : ''
}

const steps = computed(() => {
  const { status, interview_date: interview } = props.item
  let keys = STEPS
  if (status === 'unsure') keys = ['unsure', ...STEPS]
  else if (status === 'rejected') keys = ['planned', 'applied', ...(interview ? ['interview'] : []), 'rejected']
  const current = keys.indexOf(status)
  return keys.map((key, i) => {
    const state = i < current ? 'done' : i === current ? 'now' : 'todo'
    return { key, state, date: state === 'todo' ? '' : stepDate(key) } // steps that are not reached have no date yet
  })
})

// ---------- tabs ----------
const TAB_KEY = 'tracker.detailTab'
const TABS = ['overview', 'history', 'files']
const readTab = () => {
  try {
    const stored = localStorage.getItem(TAB_KEY)
    return TABS.includes(stored) ? stored : 'overview'
  } catch {
    return 'overview'
  }
}
const tab = ref(readTab())
watch(tab, (value) => {
  try {
    localStorage.setItem(TAB_KEY, value)
  } catch {}
})

// ---------- history ----------
const events = computed(() => props.item.events ?? [])
const noteText = ref('')
const noteDate = ref(today())
const noteError = ref('')

const statusName = (key) => (key ? t(`status.${key}`) : '')
function eventLabel(e) {
  if (e.kind === 'created') return t('history.created', { status: statusName(e.status) })
  if (e.kind === 'status') return t('history.status', { status: statusName(e.status) })
  return e.text
}

async function addNote() {
  const text = noteText.value.trim()
  if (!text) {
    noteError.value = t('history.needText')
    return
  }
  try {
    await api.addNote(props.item.id, text, noteDate.value || today())
    noteText.value = ''
    noteError.value = ''
    emit('changed')
  } catch (err) {
    noteError.value = err.message
  }
}

async function removeNote(e) {
  try {
    await api.removeEvent(e.id)
    emit('changed')
  } catch (err) {
    noteError.value = err.message
  }
}

// ---------- attachments ----------
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
  if (!(await askConfirm(t('attachment.confirmDelete', { name: a.name })))) return
  uploadError.value = ''
  try {
    await api.removeAttachment(a.id)
    emit('changed')
  } catch (err) {
    uploadError.value = err.message
  }
}

// ---------- footer and keys ----------
const updatedText = computed(() => {
  if (!props.item.updated_at) return ''
  const when = new Date(props.item.updated_at).toLocaleString(locale.value === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  return t('detail.changed', { date: when })
})

// Left and right arrow, J and K go to the previous or next application, unless something is being typed.
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || edit.value) return
  const target = e.target
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) return
  if (document.querySelector('.overlay.confirm')) return
  if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); emit('prev') }
  else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); emit('next') }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="overlay" v-backdrop-close="() => $emit('close')">
    <section class="dialog detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <header class="detail-head">
        <CompanyLogo :item="item" large always />
        <div class="head-main">
          <h2 id="detail-title">
            {{ item.company }}
            <button
              class="star"
              :class="{ on: item.is_favorite }"
              :aria-label="item.is_favorite ? t('fav.remove') : t('fav.add')"
              @click="$emit('favorite', item)"
            >{{ item.is_favorite ? '★' : '☆' }}</button>
          </h2>
          <p class="sub">{{ subtitle }}</p>
        </div>
        <div v-if="index >= 0 && count > 1" class="pager">
          <button :disabled="index === 0" :aria-label="t('detail.prev')" :title="t('detail.prev')" @click="$emit('prev')">‹</button>
          <span>{{ index + 1 }} / {{ count }}</span>
          <button :disabled="index === count - 1" :aria-label="t('detail.next')" :title="t('detail.next')" @click="$emit('next')">›</button>
        </div>
        <button class="close" :aria-label="t('btn.close')" @click="$emit('close')">✕</button>
      </header>

      <div class="detail-state">
        <span class="status-cell" :class="item.status">
          <Icon :name="item.status" />
          <select
            class="badge status-select"
            :class="item.status"
            :value="item.status"
            :aria-label="t('field.status')"
            @change="$emit('status', item, $event.target.value)"
          >
            <option v-for="key in STATUS_KEYS" :key="key" :value="key">{{ t(`status.${key}`) }}</option>
          </select>
        </span>
        <select
          class="kind-select"
          :class="kindClass(item.kind)"
          :value="item.kind"
          :aria-label="t('field.kind')"
          @change="$emit('kind', item, $event.target.value)"
        >
          <option value="">{{ t('field.kind') }}: –</option>
          <option v-for="k in kindOptions" :key="k" :value="k">{{ kindName(k) }}</option>
        </select>
        <span v-if="nextDate" class="next-date" :class="{ due: nextDate.due }">{{ nextDate.text }}</span>
        <span class="quick-actions">
          <a v-if="item.email" :href="`mailto:${item.email}`">✉ {{ t('detail.mail') }}</a>
          <a v-if="item.phone" :href="`tel:${item.phone}`">☎ {{ t('detail.call') }}</a>
          <a v-if="item.link" :href="item.link" target="_blank" rel="noopener">↗ {{ t('detail.posting') }}</a>
        </span>
      </div>

      <ol class="stepper" :aria-label="t('detail.process')">
        <li v-for="s in steps" :key="s.key" class="st" :class="[s.state, s.key]">
          <i aria-hidden="true"></i>
          <b>{{ t(`status.${s.key}`) }}</b>
          <small>{{ s.date || (s.state === 'todo' ? t('detail.open') : '') }}</small>
        </li>
      </ol>

      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="tab === 'overview'" :class="{ on: tab === 'overview' }" @click="tab = 'overview'">{{ t('detail.overview') }}</button>
        <button role="tab" :aria-selected="tab === 'history'" :class="{ on: tab === 'history' }" @click="tab = 'history'">
          {{ t('history.title') }} <span class="k">{{ events.length }}</span>
        </button>
        <button role="tab" :aria-selected="tab === 'files'" :class="{ on: tab === 'files' }" @click="tab = 'files'">
          {{ t('attachment.title') }} <span class="k">{{ item.attachments?.length || 0 }}</span>
        </button>
      </div>

      <div v-if="tab === 'overview'" class="overview" role="tabpanel">
        <div class="cards">
          <section v-for="s in shownSections" :key="s.id" class="sec" :class="{ wide: s.id === 'notes' }">
            <h4>{{ sectionTitle(s) }}</h4>
            <div v-for="row in s.rows" :key="row.key" class="f" :class="{ editing: edit?.key === row.key, empty: row.empty }">
              <span class="l">{{ t(row.label) }}</span>

              <div v-if="edit?.key === row.key" class="editor" @keydown.esc.stop="cancelEdit">
                <template v-for="f in row.fields" :key="f.key">
                  <select v-if="f.type === 'select'" v-model="edit.draft[f.key]" :aria-label="t(f.label)">
                    <option value="">–</option>
                    <option v-for="o in f.options" :key="o" :value="o">{{ t(`${f.optionsPrefix}.${o}`) }}</option>
                  </select>
                  <textarea
                    v-else-if="f.type === 'textarea'"
                    v-model="edit.draft[f.key]"
                    rows="3"
                    :aria-label="t(f.label)"
                    @keydown.ctrl.enter.prevent="saveEdit"
                  />
                  <input
                    v-else
                    v-model="edit.draft[f.key]"
                    :type="f.type"
                    :placeholder="row.fields.length > 1 ? t(f.label) : undefined"
                    :aria-label="t(f.label)"
                    @keydown.enter.prevent="saveEdit"
                  />
                </template>
                <div class="editor-actions">
                  <button type="button" class="primary" @click="saveEdit">{{ t('btn.save') }}</button>
                  <button type="button" @click="cancelEdit">{{ t('btn.cancel') }}</button>
                </div>
              </div>

              <div v-else class="v" @click="startEdit(row)">
                <a v-if="row.href" :href="row.href" :target="row.external ? '_blank' : null" rel="noopener" @click.stop>{{ row.value }}</a>
                <span v-else-if="row.value" :class="{ pre: row.pre }">{{ row.value }}</span>
                <span v-else class="placeholder">–</span>
                <button class="pen" :aria-label="t('detail.editField', { name: t(row.label) })" @click.stop="startEdit(row)">✎</button>
              </div>
            </div>
          </section>
        </div>
        <p v-if="!shownSections.length" class="sub">{{ t('detail.nothingFilled') }}</p>
        <div v-if="hiddenRows.length" class="not-filled">
          <span class="sub">{{ t('detail.notFilled') }}</span>
          <button v-for="row in hiddenRows" :key="row.key" class="add-field" @click="startEdit(row)">+ {{ t(row.label) }}</button>
        </div>
      </div>

      <div v-else-if="tab === 'history'" class="panel" role="tabpanel">
        <ul v-if="events.length" class="timeline">
          <li v-for="e in events" :key="e.id" :class="e.status || 'note'">
            <div>
              <strong v-if="e.kind !== 'note'">{{ eventLabel(e) }}</strong>
              <span v-else class="pre">{{ e.text }}</span>
              <span class="sub">{{ fmt(e.date) }}</span>
            </div>
            <button v-if="e.kind === 'note'" :aria-label="t('history.remove')" @click="removeNote(e)">×</button>
          </li>
        </ul>
        <p v-else class="sub">{{ t('history.empty') }}</p>
        <form class="note-form" @submit.prevent="addNote">
          <input v-model="noteText" type="text" :placeholder="t('history.placeholder')" :aria-label="t('history.placeholder')" @input="noteError = ''" />
          <input v-model="noteDate" type="date" :aria-label="t('field.date')" />
          <button type="submit">{{ t('history.add') }}</button>
        </form>
        <p v-if="noteError" class="error">{{ noteError }}</p>
      </div>

      <div v-else class="panel" role="tabpanel">
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
      </div>

      <footer class="detail-foot">
        <span class="sub">{{ updatedText }}</span>
        <span class="buttons">
          <button @click="$emit('remove', item)">{{ t('btn.delete') }}</button>
          <button @click="$emit('duplicate', item)">{{ t('detail.duplicate') }}</button>
          <button class="primary" @click="$emit('edit')">{{ t('btn.edit') }}</button>
        </span>
      </footer>
    </section>
  </div>
</template>
