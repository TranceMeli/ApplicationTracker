<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from './api'
import { t } from './i18n'
import { askConfirm, confirmState } from './confirm'
import { downloadApplications, downloadCalendar } from './exporter'
import { VIEWS, loadView, saveView } from './geo'
import { showToast } from './toast'
import { knownKinds } from './kind'
import { theme, toggleTheme } from './theme'
import FilterBar from './components/FilterBar.vue'
import ApplicationTable from './components/ApplicationTable.vue'
import ApplicationBoard from './components/ApplicationBoard.vue'
import DetailModal from './components/DetailModal.vue'
import ApplicationForm from './components/ApplicationForm.vue'
import FieldSettings from './components/FieldSettings.vue'
import ImportDialog from './components/ImportDialog.vue'
import LanguageSwitch from './components/LanguageSwitch.vue'
import CompanyCards from './components/CompanyCards.vue'
import GeoBar from './components/GeoBar.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import StatsPage from './components/StatsPage.vue'
import BulkBar from './components/BulkBar.vue'
import ToastBar from './components/ToastBar.vue'

// The map library is only loaded when the map view is opened.
const CompanyMap = defineAsyncComponent(() => import('./components/CompanyMap.vue'))

const GROUP_KEY = 'tracker.group'
const readGroup = () => {
  try {
    return localStorage.getItem(GROUP_KEY) === '1'
  } catch {
    return false
  }
}

const items = ref([])
const stats = ref({})
const search = ref('')
const statusFilter = ref('')
const favoriteOnly = ref(false)
const tagFilter = ref('')
const kindFilter = ref('')
const groupByCompany = ref(readGroup())
const dueOnly = ref(false)
const selected = ref([])
const backendDown = ref(false)
const errorText = ref('')
const editing = ref(null) // null = closed, {} = new, {id, ...} = edit
const companies = ref([]) // id and name of every application, for the warning about doubles
const detailId = ref(null)
const showSettings = ref(false)
const showImport = ref(false)
const page = ref('applications') // 'applications' or 'stats'
const allItems = ref([]) // for the statistics, regardless of the filters
const view = ref(loadView()) // 'list', 'cards', 'board' or 'map'
const year = new Date().getFullYear()

const total = computed(() => stats.value.total ?? 0)
const kindKeys = computed(() => knownKinds(stats.value.by_kind).map((k) => k.key))
const due = computed(() => stats.value.due ?? [])
const detail = computed(() => items.value.find((i) => i.id === detailId.value) || null)
const error = computed(() => (backendDown.value ? t('app.backendDown') : errorText.value))

// Oldest first, so the numbers run 1, 2, 3 ... in the order the entries were created.
const sortedItems = computed(() => [...items.value].sort((a, b) => a.id - b.id))
const detailNumber = computed(() => sortedItems.value.findIndex((i) => i.id === detailId.value) + 1)

// "Show due follow ups" narrows the list to the applications named in the banner.
const visibleItems = computed(() => {
  if (!dueOnly.value) return sortedItems.value
  const ids = new Set(due.value.map((d) => d.id))
  return sortedItems.value.filter((i) => ids.has(i.id))
})

// Only the newest request may update the list, a slower older one is dropped.
let loadId = 0

async function load() {
  const id = ++loadId
  const params = {}
  if (search.value) params.search = search.value
  if (statusFilter.value) params.status = statusFilter.value
  if (favoriteOnly.value) params.favorite = '1'
  if (tagFilter.value) params.tag = tagFilter.value
  if (kindFilter.value) params.kind = kindFilter.value
  try {
    const [list, counts] = await Promise.all([api.list(params), api.stats()])
    if (id !== loadId) return
    items.value = list
    stats.value = counts
    selected.value = selected.value.filter((sid) => list.some((i) => i.id === sid))
    if (!counts.due?.length) dueOnly.value = false
    if (tagFilter.value && !(tagFilter.value in (counts.tags ?? {}))) tagFilter.value = ''
    backendDown.value = false
    errorText.value = ''
  } catch (e) {
    if (id === loadId) backendDown.value = true
  }
}

async function mutate(operation) {
  try {
    await operation()
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
  if (saved) closeForm()
}

async function changeStatus(item, status) {
  await mutate(() => api.update(item.id, { status }))
}

async function toggleFavorite(item) {
  await mutate(() => api.update(item.id, { is_favorite: !item.is_favorite }))
}

// Deleting only moves entries to the trash, so the toast can offer "Undo".
async function restore(ids) {
  if (await mutate(() => api.bulk(ids, 'restore'))) showToast(t('undo.restored'), { ms: 3000 })
}

async function remove(item) {
  if (!(await askConfirm(t('app.confirmDelete', { name: item.company })))) return
  const removed = await mutate(() => api.remove(item.id))
  if (!removed) return
  if (detailId.value === item.id) detailId.value = null
  showToast(t('undo.deleted', { name: item.company }), { actionLabel: t('undo.action'), onAction: () => restore([item.id]) })
}

async function bulkStatus(status) {
  await mutate(() => api.bulk(selected.value, 'status', status))
}

async function bulkKind(kind) {
  await mutate(() => api.bulk(selected.value, 'kind', kind))
}

async function bulkDelete() {
  const ids = [...selected.value]
  if (!(await askConfirm(t('app.confirmDeleteMany', { n: ids.length })))) return
  if (!(await mutate(() => api.bulk(ids, 'delete')))) return
  selected.value = []
  showToast(t('undo.deletedMany', { n: ids.length }), { actionLabel: t('undo.action'), onAction: () => restore(ids) })
}

async function exportData() {
  try {
    const all = await api.list() // everything, regardless of the current filters
    downloadApplications(all.sort((a, b) => a.id - b.id))
  } catch (e) {
    backendDown.value = true
  }
}

async function exportCalendar() {
  try {
    if (!downloadCalendar(await api.list())) showToast(t('calendar.empty'), { ms: 4000 })
  } catch (e) {
    backendDown.value = true
  }
}

function showAll() {
  page.value = 'applications'
  search.value = ''
  statusFilter.value = ''
  favoriteOnly.value = false
  tagFilter.value = ''
  kindFilter.value = ''
  dueOnly.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function showStats() {
  page.value = 'stats'
  try {
    allItems.value = await api.list()
    backendDown.value = false
  } catch (e) {
    backendDown.value = true
  }
}

async function openForm(item) {
  editing.value = item
  try {
    companies.value = await api.companies()
  } catch {
    companies.value = []
  }
}

function closeForm() {
  editing.value = null
  errorText.value = ''
}

function editFromDetail() {
  openForm(detail.value)
  detailId.value = null
}

function onKey(e) {
  if (e.key !== 'Escape' || confirmState.value) return // the confirm dialog handles its own Escape
  if (showImport.value) showImport.value = false
  else if (showSettings.value) showSettings.value = false
  else if (editing.value) closeForm()
  else detailId.value = null
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 250) })
watch(statusFilter, load)
watch(favoriteOnly, load)
watch(tagFilter, load)
watch(kindFilter, load)
watch(view, saveView)
watch(groupByCompany, (value) => {
  try {
    localStorage.setItem(GROUP_KEY, value ? '1' : '0')
  } catch {}
})
onMounted(() => { load(); window.addEventListener('keydown', onKey) })
onUnmounted(() => { clearTimeout(timer); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <header class="site-header">
    <div class="bar">
      <a href="#" class="brand" @click.prevent="showAll">{{ t('app.name') }}</a>

      <nav class="site-nav" :aria-label="t('nav.label')">
        <button :class="{ active: page === 'applications' }" :aria-current="page === 'applications' ? 'page' : null" @click="showAll">{{ t('nav.applications') }}</button>
        <button :class="{ active: page === 'stats' }" :aria-current="page === 'stats' ? 'page' : null" @click="showStats">{{ t('nav.stats') }}</button>
        <button @click="showImport = true">{{ t('import.button') }}</button>
        <button @click="exportData">{{ t('export.button') }}</button>
        <button @click="exportCalendar">{{ t('nav.calendar') }}</button>
        <a class="nav-link" href="/api/backup/" download>{{ t('nav.backup') }}</a>
        <button @click="showSettings = true">{{ t('settings.fields') }}</button>
      </nav>

      <div class="bar-end">
        <button
          class="theme-toggle"
          :aria-label="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
          :title="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
          @click="toggleTheme"
        >{{ theme === 'dark' ? '☀' : '☾' }}</button>
        <LanguageSwitch />
        <button class="primary new-button" @click="openForm({})">{{ t('app.new') }}</button>
      </div>
    </div>
  </header>

  <main>
    <template v-if="page === 'stats'">
      <div class="page-head"><h1>{{ t('stats.title') }}</h1></div>
      <p v-if="error" class="error">{{ error }}</p>
      <StatsPage :items="allItems" :due="due" />
    </template>

    <template v-else>
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

      <div v-if="due.length" class="due-banner" role="status">
        <strong>{{ t('due.banner', { n: due.length }) }}</strong>
        <span class="due-names">{{ due.slice(0, 3).map((d) => d.company).join(' · ') }}{{ due.length > 3 ? ' …' : '' }}</span>
        <button class="link" @click="dueOnly = !dueOnly">{{ dueOnly ? t('due.hide') : t('due.show') }}</button>
      </div>

      <FilterBar
        v-model:search="search"
        v-model:status="statusFilter"
        v-model:favorite="favoriteOnly"
        v-model:tag="tagFilter"
        v-model:kind="kindFilter"
        v-model:group="groupByCompany"
        :stats="stats"
        :total="total"
        :show-group="view === 'list'"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <BulkBar
        v-if="selected.length && view === 'list'"
        :count="selected.length"
        :kinds="kindKeys"
        @status="bulkStatus"
        @kind="bulkKind"
        @delete="bulkDelete"
        @clear="selected = []"
      />

      <template v-if="visibleItems.length">
        <ApplicationTable
          v-if="view === 'list'"
          :items="visibleItems"
          :selected="selected"
          :group="groupByCompany"
          @select="(ids) => (selected = ids)"
          @open="(i) => (detailId = i.id)"
          @edit="openForm"
          @remove="remove"
          @status="changeStatus"
          @favorite="toggleFavorite"
        />
        <ApplicationBoard
          v-else-if="view === 'board'"
          :items="visibleItems"
          @open="(i) => (detailId = i.id)"
          @status="changeStatus"
        />
        <template v-else>
          <GeoBar :items="items" @changed="load" />
          <CompanyCards
            v-if="view === 'cards'"
            :items="visibleItems"
            @open="(i) => (detailId = i.id)"
            @favorite="toggleFavorite"
          />
          <CompanyMap v-else :items="visibleItems" @open="(i) => (detailId = i.id)" />
        </template>
      </template>
      <p v-else-if="!error" class="empty">{{ t('app.empty') }}</p>
    </template>

    <button class="primary fab" :aria-label="t('app.new')" @click="openForm({})">+ {{ t('app.new') }}</button>

    <DetailModal
      v-if="detail"
      :item="detail"
      :number="detailNumber"
      @close="detailId = null"
      @edit="editFromDetail"
      @remove="remove"
      @changed="load"
    />
    <ApplicationForm v-if="editing" :item="editing" :error="errorText" :companies="companies" :kinds="kindKeys" @save="save" @close="closeForm" />
    <FieldSettings v-if="showSettings" @close="showSettings = false" />
    <ImportDialog v-if="showImport" @close="showImport = false" @done="load" />
    <ConfirmDialog v-if="confirmState" />
    <ToastBar />
  </main>

  <footer class="site-footer">
    <div class="bar">
      <p>© {{ year }} {{ t('app.name') }}</p>
      <p>{{ t('footer.text') }}</p>
    </div>
  </footer>
</template>
