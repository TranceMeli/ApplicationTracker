<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { api } from './api'
import { t } from './i18n'
import { downloadApplications } from './exporter'
import FilterBar from './components/FilterBar.vue'
import ApplicationTable from './components/ApplicationTable.vue'
import DetailModal from './components/DetailModal.vue'
import ApplicationForm from './components/ApplicationForm.vue'
import FieldSettings from './components/FieldSettings.vue'
import ImportDialog from './components/ImportDialog.vue'
import LanguageSwitch from './components/LanguageSwitch.vue'

const items = ref([])
const stats = ref({})
const search = ref('')
const statusFilter = ref('')
const favoriteOnly = ref(false)
const backendDown = ref(false)
const errorText = ref('')
const editing = ref(null) // null = closed, {} = new, {id, ...} = edit
const detailId = ref(null)
const showSettings = ref(false)
const showImport = ref(false)
const year = new Date().getFullYear()

const total = computed(() => Object.values(stats.value).reduce((a, b) => a + b, 0))
const detail = computed(() => items.value.find((i) => i.id === detailId.value) || null)
const error = computed(() => (backendDown.value ? t('app.backendDown') : errorText.value))

// Oldest first, so the numbers run 1, 2, 3 ... in the order the entries were created.
const sortedItems = computed(() => [...items.value].sort((a, b) => a.id - b.id))
const detailNumber = computed(() => sortedItems.value.findIndex((i) => i.id === detailId.value) + 1)

async function load() {
  try {
    backendDown.value = false
    errorText.value = ''
    const params = {}
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (favoriteOnly.value) params.favorite = '1'
    ;[items.value, stats.value] = await Promise.all([api.list(params), api.stats()])
  } catch (e) {
    backendDown.value = true
  }
}

async function save(id, data) {
  try {
    id ? await api.update(id, data) : await api.create(data)
    editing.value = null
    load()
  } catch (e) {
    errorText.value = e.message
  }
}

async function changeStatus(item, status) {
  await api.update(item.id, { status })
  load()
}

async function toggleFavorite(item) {
  await api.update(item.id, { is_favorite: !item.is_favorite })
  load()
}

async function remove(item) {
  if (!confirm(t('app.confirmDelete', { name: item.company }))) return
  await api.remove(item.id)
  if (detailId.value === item.id) detailId.value = null
  load()
}

async function exportData() {
  try {
    const all = await api.list() // everything, regardless of the current filters
    downloadApplications(all.sort((a, b) => a.id - b.id))
  } catch (e) {
    backendDown.value = true
  }
}

function showAll() {
  search.value = ''
  statusFilter.value = ''
  favoriteOnly.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function editFromDetail() {
  editing.value = detail.value
  detailId.value = null
}

function onKey(e) {
  if (e.key !== 'Escape') return
  if (showImport.value) showImport.value = false
  else if (showSettings.value) showSettings.value = false
  else if (editing.value) editing.value = null
  else detailId.value = null
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 250) })
watch(statusFilter, load)
watch(favoriteOnly, load)
onMounted(() => { load(); window.addEventListener('keydown', onKey) })
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <header class="site-header">
    <div class="bar">
      <a href="#" class="brand" @click.prevent="showAll">{{ t('app.name') }}</a>

      <nav class="site-nav" :aria-label="t('nav.label')">
        <button class="active" aria-current="page" @click="showAll">{{ t('nav.applications') }}</button>
        <button @click="showImport = true">{{ t('import.button') }}</button>
        <button @click="exportData">{{ t('export.button') }}</button>
        <button @click="showSettings = true">{{ t('settings.fields') }}</button>
      </nav>

      <div class="bar-end">
        <LanguageSwitch />
        <button class="primary" @click="editing = {}">{{ t('app.new') }}</button>
      </div>
    </div>
  </header>

  <main>
    <h1>{{ t('app.title') }}</h1>

    <FilterBar
      v-model:search="search"
      v-model:status="statusFilter"
      v-model:favorite="favoriteOnly"
      :stats="stats"
      :total="total"
    />

    <p v-if="error" class="error">{{ error }}</p>

    <ApplicationTable
      v-if="items.length"
      :items="sortedItems"
      @open="(i) => (detailId = i.id)"
      @edit="(i) => (editing = i)"
      @remove="remove"
      @status="changeStatus"
      @favorite="toggleFavorite"
    />
    <p v-else-if="!error" class="empty">{{ t('app.empty') }}</p>

    <DetailModal
      v-if="detail"
      :item="detail"
      :number="detailNumber"
      @close="detailId = null"
      @edit="editFromDetail"
      @remove="remove"
      @changed="load"
    />
    <ApplicationForm v-if="editing" :item="editing" @save="save" @close="editing = null" />
    <FieldSettings v-if="showSettings" @close="showSettings = false" />
    <ImportDialog v-if="showImport" @close="showImport = false" @done="load" />
  </main>

  <footer class="site-footer">
    <div class="bar">
      <p>© {{ year }} {{ t('app.name') }}</p>
      <p>{{ t('footer.text') }}</p>
    </div>
  </footer>
</template>