<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from './api'
import { t } from './i18n'
import { downloadApplications } from './exporter'
import { VIEWS, loadView, saveView } from './geo'
import FilterBar from './components/FilterBar.vue'
import ApplicationTable from './components/ApplicationTable.vue'
import DetailModal from './components/DetailModal.vue'
import ApplicationForm from './components/ApplicationForm.vue'
import FieldSettings from './components/FieldSettings.vue'
import ImportDialog from './components/ImportDialog.vue'
import LanguageSwitch from './components/LanguageSwitch.vue'
import CompanyCards from './components/CompanyCards.vue'
import GeoBar from './components/GeoBar.vue'

// The map library is only loaded when the map view is opened.
const CompanyMap = defineAsyncComponent(() => import('./components/CompanyMap.vue'))

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
const view = ref(loadView()) // 'list', 'cards' or 'map'
const year = new Date().getFullYear()

const total = computed(() => stats.value.total ?? 0)
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

async function mutate(operation) {
  try {
    await operation()
    errorText.value = ''
    await load()
    return true
  } catch (e) {
    backendDown.value = false
    errorText.value = e.message
    return false
  }
}

async function save(id, data) {
  const saved = await mutate(() => id ? api.update(id, data) : api.create(data))
  if (saved) {
    editing.value = null
  }
}

async function changeStatus(item, status) {
  await mutate(() => api.update(item.id, { status }))
}

async function toggleFavorite(item) {
  await mutate(() => api.update(item.id, { is_favorite: !item.is_favorite }))
}

async function remove(item) {
  if (!confirm(t('app.confirmDelete', { name: item.company }))) return
  const removed = await mutate(() => api.remove(item.id))
  if (removed && detailId.value === item.id) detailId.value = null
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
watch(view, saveView)
onMounted(() => { load(); window.addEventListener('keydown', onKey) })
onUnmounted(() => { clearTimeout(timer); window.removeEventListener('keydown', onKey) })
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
    <div class="page-head">
      <h1>{{ t('app.title') }}</h1>
      <div class="view-switch" role="group" :aria-label="t('view.label')">
        <button
          v-for="v in VIEWS"
          :key="v"
          :class="{ active: view === v }"
          :aria-pressed="view === v"
          @click="view = v"
        >{{ t(`view.${v}`) }}</button>
      </div>
    </div>

    <FilterBar
      v-model:search="search"
      v-model:status="statusFilter"
      v-model:favorite="favoriteOnly"
      :stats="stats"
      :total="total"
    />

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="items.length">
      <ApplicationTable
        v-if="view === 'list'"
        :items="sortedItems"
        @open="(i) => (detailId = i.id)"
        @edit="(i) => (editing = i)"
        @remove="remove"
        @status="changeStatus"
        @favorite="toggleFavorite"
      />
      <template v-else>
        <GeoBar :items="items" @changed="load" />
        <CompanyCards
          v-if="view === 'cards'"
          :items="sortedItems"
          @open="(i) => (detailId = i.id)"
          @favorite="toggleFavorite"
        />
        <CompanyMap v-else :items="sortedItems" @open="(i) => (detailId = i.id)" />
      </template>
    </template>
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