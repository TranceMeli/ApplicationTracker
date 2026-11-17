<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { vBackdropClose } from '../backdrop'
import { api } from '../api'
import { today } from '../constants'
import { t } from '../i18n'
import { buildName, checkFile, extensionOf, findCompany, guessCompany, guessKind, companyKey, uniqueNames } from '../inbox'
import { useUnsaved } from '../unsaved'
import DiscardGuard from './DiscardGuard.vue'

const props = defineProps({
  companies: { type: Array, default: () => [] }, // id and name of every application
  files: { type: Array, default: () => [] }, // files that were dropped or pasted on the page
})
const emit = defineEmits(['close', 'done'])

const KINDS = ['cover_letter', 'cv', 'certificate', 'complete', 'other']
const NAMING = 'tracker.inboxNaming'
const readNaming = () => {
  try {
    return localStorage.getItem(NAMING) !== '0'
  } catch {
    return true
  }
}

const rows = ref([])
const naming = ref(readNaming()) // true = Date_Company_Kind.ext, false = the file keeps its own name
const everyCompany = ref('')
const busy = ref(false)
const failure = ref('')
const picker = ref(null)
const fileInput = ref(null)
let nextId = 1

function setNaming(value) {
  naming.value = value
  try {
    localStorage.setItem(NAMING, value ? '1' : '0')
  } catch {}
}

function addFiles(list) {
  for (const file of list) {
    const match = guessCompany(file.name, props.companies)
    rows.value.push({
      id: nextId++,
      file,
      company: match?.company ?? everyCompany.value,
      kind: guessKind(file.name),
      nameOverride: null, // set once the name is edited by hand
      error: checkFile(file),
      companyError: false,
    })
  }
}

const active = computed(() => rows.value.filter((r) => !r.error))
const uniqueCompanyNames = computed(() => [...new Set(props.companies.map((c) => c.company))])

// The proposed names. Equal names inside the batch are numbered, so nothing overwrites anything.
const names = computed(() => {
  const date = today()
  const proposed = active.value.map((r) =>
    r.nameOverride ?? (naming.value ? buildName({ date, company: r.company, kindLabel: t(`kind.${r.kind}`), filename: r.file.name }) : r.file.name),
  )
  const numbered = uniqueNames(proposed)
  return Object.fromEntries(active.value.map((r, i) => [r.id, numbered[i]]))
})

// Only an edited name is stored on the row; it keeps the extension of the file.
function editName(row, value) {
  row.nameOverride = value
}
function finalName(row) {
  const name = (names.value[row.id] || '').trim() || row.file.name
  const ext = extensionOf(row.file.name)
  return ext && !name.toLowerCase().endsWith(ext) ? name + ext : name
}

const isNew = (row) => !!row.company.trim() && !findCompany(row.company, props.companies)

// "All files belong to ..." fills in the rows that have no company yet.
function applyEvery() {
  for (const r of rows.value) if (!r.company.trim()) r.company = everyCompany.value
}

function remove(row) {
  rows.value = rows.value.filter((r) => r.id !== row.id)
}

function onPick(e) {
  addFiles([...e.target.files])
  e.target.value = ''
}

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
function onDrop(e) {
  if (hasFiles(e)) addFiles([...e.dataTransfer.files])
}
function onPaste(e) {
  const files = [...(e.clipboardData?.files ?? [])]
  if (!files.length) return
  e.preventDefault()
  addFiles(files)
}

async function submit() {
  failure.value = ''
  for (const r of active.value) r.companyError = !r.company.trim()
  const first = active.value.find((r) => r.companyError)
  if (first) {
    await nextTick()
    return document.getElementById(`inbox-company-${first.id}`)?.focus()
  }
  if (!active.value.length) return
  busy.value = true
  const created = new Map() // companies that were new in this batch, so each one is created only once
  let stored = 0
  for (const row of [...active.value]) {
    try {
      const known = findCompany(row.company, props.companies)
      const key = companyKey(row.company)
      let id = known?.id ?? created.get(key)
      if (!id) {
        const application = await api.create({ company: row.company.trim(), status: 'planned', date: today() })
        id = application.id
        created.set(key, id)
      }
      await api.upload(id, row.file, row.kind, finalName(row))
      stored++
      remove(row)
    } catch (err) {
      row.error = ['file_type', 'file_size'].includes(err.message) ? err.message : 'other'
      row.errorText = err.message
      row.attempted = true
    }
  }
  busy.value = false
  if (stored) emit('done', { files: stored, created: created.size, rest: rows.value.length })
  // Files that were rejected before the click were already shown with their reason; only a failed try keeps the dialog open.
  if (!rows.value.some((r) => r.attempted)) emit('close')
  else failure.value = t('inbox.failed')
}

const { asking, request, keep } = useUnsaved(() => rows.value.length > 0 && !busy.value, () => emit('close'))
const discard = () => emit('close')

onMounted(async () => {
  window.addEventListener('paste', onPaste)
  addFiles(props.files)
  await nextTick()
  const empty = document.querySelector('.inbox-company-input:not(:disabled)')
  ;(empty?.value === '' ? empty : picker.value)?.focus()
})
onUnmounted(() => window.removeEventListener('paste', onPaste))
</script>

<template>
  <div class="overlay" v-backdrop-close="request" @dragover.prevent @drop.prevent="onDrop">
    <form class="dialog inbox" novalidate @submit.prevent="submit">
      <h2>{{ t('inbox.title') }}</h2>

      <div class="inbox-drop wide">
        <p>{{ t('inbox.drop') }}</p>
        <button ref="picker" type="button" @click="fileInput.click()">{{ t('inbox.choose') }}</button>
        <input ref="fileInput" type="file" multiple hidden :accept="'.pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg'" @change="onPick" />
      </div>

      <template v-if="rows.length">
        <label v-if="rows.length > 1" class="wide inbox-every">
          {{ t('inbox.every') }}
          <input v-model="everyCompany" type="text" list="inbox-companies" autocomplete="off" :placeholder="t('inbox.everyHint')" @change="applyEvery" />
        </label>

        <ul class="inbox-rows wide">
          <li v-for="row in rows" :key="row.id" :class="{ bad: row.error }">
            <div class="inbox-file">
              <span class="inbox-original">{{ row.file.name }}</span>
              <button type="button" class="link" :aria-label="t('inbox.remove', { name: row.file.name })" @click="remove(row)">{{ t('inbox.removeShort') }}</button>
            </div>

            <p v-if="row.error" class="field-error" role="alert">
              {{ row.error === 'other' ? row.errorText : t(`attachment.error.${row.error}`) }}
            </p>

            <template v-else>
              <div class="inbox-fields">
                <label>
                  {{ t('field.company') }}
                  <input
                    :id="`inbox-company-${row.id}`"
                    v-model="row.company"
                    class="inbox-company-input"
                    type="text"
                    list="inbox-companies"
                    autocomplete="off"
                    :aria-invalid="row.companyError && !row.company.trim() ? 'true' : undefined"
                    @input="row.companyError = false"
                  />
                </label>
                <label>
                  {{ t('inbox.kind') }}
                  <select v-model="row.kind">
                    <option v-for="k in KINDS" :key="k" :value="k">{{ t(`kind.${k}`) }}</option>
                  </select>
                </label>
              </div>
              <p v-if="row.companyError && !row.company.trim()" class="field-error" role="alert">{{ t('inbox.companyRequired') }}</p>
              <p v-else-if="isNew(row)" class="inbox-new">{{ t('inbox.newApplication') }}</p>
              <label class="inbox-name">
                {{ t('inbox.name') }}
                <input type="text" class="mono" :value="names[row.id]" autocomplete="off" @input="editName(row, $event.target.value)" />
              </label>
            </template>
          </li>
        </ul>

        <label class="wide check inbox-naming">
          <input type="checkbox" :checked="naming" @change="setNaming($event.target.checked)" />
          {{ t('inbox.naming') }}
        </label>
      </template>

      <datalist id="inbox-companies">
        <option v-for="name in uniqueCompanyNames" :key="name" :value="name" />
      </datalist>

      <p v-if="failure" class="error wide" role="alert">{{ failure }}</p>
      <div class="buttons">
        <button type="button" @click="request">{{ t('btn.cancel') }}</button>
        <button class="primary" type="submit" :aria-busy="busy">
          {{ busy ? t('attachment.uploading') : t(active.length === 1 ? 'inbox.storeOne' : 'inbox.store', { n: active.length }) }}
        </button>
      </div>
      <DiscardGuard v-if="asking" @keep="keep" @discard="discard" />
    </form>
  </div>
</template>
