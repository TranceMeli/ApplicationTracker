<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from './api'
import { today } from './constants'
import { t } from './i18n'
import { askConfirm, confirmState } from './confirm'
import { downloadApplications, downloadCalendar } from './exporter'
import { VIEWS, loadView, saveView } from './geo'
import { showToast } from './toast'
import { clearDraft } from './draft'
import { buildToday } from './today'
import { knownKinds } from './kind'
import { theme, themeChoice, toggleTheme } from './theme'
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
import MenuButton from './components/MenuButton.vue'
import QuickAddDialog from './components/QuickAddDialog.vue'
import InboxDialog from './components/InboxDialog.vue'
import TodayPanel from './components/TodayPanel.vue'
import Icon from './components/Icon.vue'

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
const waitingOnly = ref(false)
const selected = ref([])
const backendDown = ref(false)
const loaded = ref(false) // false until the first answer (or failure) of the backend, shows the placeholder
const errorText = ref('')
const editing = ref(null) // null = closed, {} = new, {id, ...} = edit
const companies = ref([]) // id and name of every application, for the warning about doubles
const detailId = ref(null)
const showSettings = ref(false)
const showImport = ref(false)
const inboxFiles = ref(null) // null = closed, otherwise the files that came with the drop or paste
const fileDrag = ref(false) // files are dragged over the page
const quickAdd = ref(false) // the small dialog for a new application
const page = ref('applications') // 'applications' or 'stats'
const allItems = ref([]) // for the statistics, regardless of the filters
const view = ref(loadView()) // 'list', 'cards', 'board' or 'map'
const year = new Date().getFullYear()

const total = computed(() => stats.value.total ?? 0)
const kindKeys = computed(() => knownKinds(stats.value.by_kind).map((k) => k.key))
const due = computed(() => stats.value.due ?? [])
const detail = computed(
  () => items.value.find((i) => i.id === detailId.value) || (pinned.value?.id === detailId.value ? pinned.value : null),
)
const error = computed(() => (backendDown.value ? t('app.backendDown') : errorText.value))
const hasFilters = computed(() => !!(search.value || statusFilter.value || favoriteOnly.value || tagFilter.value || kindFilter.value || dueOnly.value || waitingOnly.value))

// Oldest first, so the numbers run 1, 2, 3 ... in the order the entries were created.
const sortedItems = computed(() => [...items.value].sort((a, b) => a.id - b.id))
const detailNumber = computed(() => sortedItems.value.findIndex((i) => i.id === detailId.value) + 1)

// The applications that have waited a long time for an answer, see the Today panel.
const waitingIds = computed(() => new Set(buildToday(items.value, due.value).waiting.map((w) => w.id)))

// "Show all" in the Today panel narrows the list to the due follow ups or to the applications that wait for an answer.
const visibleItems = computed(() => {
  let list = sortedItems.value
  if (dueOnly.value) {
    const ids = new Set(due.value.map((d) => d.id))
    list = list.filter((i) => ids.has(i.id))
  }
  if (waitingOnly.value) list = list.filter((i) => waitingIds.value.has(i.id))
  return list
})

const detailIndex = computed(() => visibleItems.value.findIndex((i) => i.id === detailId.value))

function stepDetail(step) {
  const target = visibleItems.value[detailIndex.value + step]
  if (target) detailId.value = target.id
}

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
    if (waitingOnly.value && !waitingIds.value.size) waitingOnly.value = false
    if (tagFilter.value && !(tagFilter.value in (counts.tags ?? {}))) tagFilter.value = ''
    backendDown.value = false
    errorText.value = ''
    loaded.value = true
  } catch (e) {
    if (id === loadId) { backendDown.value = true; loaded.value = true }
  }
}

async function mutate(operation) {
  try {
    const result = await operation()
    await load()
    return result ?? true
  } catch (e) {
    backendDown.value = false
    errorText.value = e.message
    return false
  }
}

async function save(id, data) {
  const saved = await mutate(() => id ? api.update(id, data) : api.create(data))
  if (!saved) return
  if (!id) clearDraft()
  closeForm()
  showToast(t(id ? 'toast.saved' : 'toast.added', { name: data.company }), { ms: 4000 })
}

// The detail view can change an application so that it drops out of the filtered list (a new status, for example).
// The updated copy is kept, so the dialog does not close under the user's hands.
const pinned = ref(null)

async function updateItem(item, patch) {
  const updated = await mutate(() => api.update(item.id, patch))
  if (updated && updated !== true && item.id === detailId.value) pinned.value = updated
  return updated
}

async function changeStatus(item, status) {
  const before = item.status
  const updated = await updateItem(item, { status })
  if (updated && before !== status) {
    showToast(t('toast.status', { name: item.company, status: t(`status.${status}`) }), {
      actionLabel: t('undo.action'),
      onAction: () => updateItem(item, { status: before }),
      ms: 6000,
    })
  }
  return updated
}
const changeKind = (item, kind) => updateItem(item, { kind })
const toggleFavorite = (item) => updateItem(item, { is_favorite: !item.is_favorite })

// A copy of an application (another position at the same company) starts in the full form.
const COPIED = ['company', 'position', 'street', 'postal_code', 'city', 'contact_person', 'email', 'phone', 'link', 'source', 'channel', 'work_mode', 'salary', 'tags', 'kind']
function duplicate(item) {
  const copy = Object.fromEntries(COPIED.map((key) => [key, item[key] ?? '']))
  detailId.value = null
  openForm({ ...copy, status: 'planned', date: today() })
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

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  favoriteOnly.value = false
  tagFilter.value = ''
  kindFilter.value = ''
  dueOnly.value = false
  waitingOnly.value = false
}

function showAll() {
  page.value = 'applications'
  clearFilters()
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

// "New application" opens the small dialog, "Show all fields" there continues in the full form.
async function openNew() {
  quickAdd.value = true
  try {
    companies.value = await api.companies()
  } catch {
    companies.value = []
  }
}

// Files dropped or pasted on the page open the inbox, where they get a company, a kind and a name.
// While a dialog is open the dialog decides (the detail view attaches them to its own application).
const overlayOpen = () => !!document.querySelector('.overlay')
const withFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
let dragDepth = 0

async function openInbox(files = []) {
  try {
    companies.value = await api.companies()
  } catch {
    companies.value = []
  }
  inboxFiles.value = files
}

function inboxDone({ files, created }) {
  showToast(created ? t('inbox.doneNew', { n: files, m: created }) : t('inbox.done', { n: files }), { ms: 5000 })
  load()
}

function onDragEnter(e) {
  if (!withFiles(e) || overlayOpen()) return
  dragDepth++
  fileDrag.value = true
}
function onDragLeave(e) {
  if (!withFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) fileDrag.value = false
}
function onDragOver(e) {
  if (withFiles(e)) e.preventDefault() // otherwise the browser would open the file instead
}
function onDrop(e) {
  if (!withFiles(e)) return
  e.preventDefault()
  dragDepth = 0
  fileDrag.value = false
  if (!overlayOpen()) openInbox([...e.dataTransfer.files])
}
function onPaste(e) {
  if (overlayOpen()) return
  const files = [...(e.clipboardData?.files ?? [])]
  if (!files.length) return
  e.preventDefault()
  openInbox(files)
}

function expandQuick(data) {
  quickAdd.value = false
  editing.value = data
}

function closeForm() {
  editing.value = null
  quickAdd.value = false
  errorText.value = ''
}

function editFromDetail() {
  openForm(detail.value)
  detailId.value = null
}

// The skip link moves the focus to the content, a plain anchor would only scroll there.
function focusMain() {
  document.getElementById('main')?.focus()
}

function onKey(e) {
  if (e.key !== 'Escape' || confirmState.value) return // the confirm dialog handles its own Escape
  if (inboxFiles.value) inboxFiles.value = null
  else if (showImport.value) showImport.value = false
  else if (showSettings.value) showSettings.value = false
  else if (quickAdd.value) closeForm()
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
const pageEvents = { dragenter: onDragEnter, dragleave: onDragLeave, dragover: onDragOver, drop: onDrop, paste: onPaste }
onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
  for (const [name, handler] of Object.entries(pageEvents)) window.addEventListener(name, handler)
})
onUnmounted(() => {
  clearTimeout(timer)
  window.removeEventListener('keydown', onKey)
  for (const [name, handler] of Object.entries(pageEvents)) window.removeEventListener(name, handler)
})
</script>

<template>
  <a href="#main" class="skip-link" @click.prevent="focusMain">{{ t('a11y.skip') }}</a>
  <header class="site-header">
    <div class="bar">
      <a href="#" class="brand" @click.prevent="showAll">{{ t('app.name') }}</a>

      <nav class="site-nav" :aria-label="t('nav.label')">
        <button :class="{ active: page === 'applications' }" :aria-current="page === 'applications' ? 'page' : null" @click="showAll">{{ t('nav.applications') }}</button>
        <button :class="{ active: page === 'stats' }" :aria-current="page === 'stats' ? 'page' : null" @click="showStats">{{ t('nav.stats') }}</button>
        <MenuButton :label="t('nav.data')" panel-class="data-panel">
          <template #default="{ close }">
            <button class="menu-item" @click="openInbox(); close()">{{ t('menu.inbox') }}</button>
            <button class="menu-item" @click="showImport = true; close()">{{ t('menu.import') }}</button>
            <button class="menu-item" @click="exportData(); close()">{{ t('menu.exportCsv') }}</button>
            <button class="menu-item" @click="exportCalendar(); close()">{{ t('menu.calendar') }}</button>
            <a class="menu-item" href="/api/backup/" download @click="close()">{{ t('menu.backup') }}</a>
          </template>
        </MenuButton>
      </nav>

      <div class="bar-end">
        <button
          class="theme-toggle"
          :aria-label="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
          :title="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
          @click="toggleTheme"
        >{{ theme === 'dark' ? '☀' : '☾' }}</button>
        <button class="primary new-button" @click="openNew">{{ t('app.new') }}</button>
        <MenuButton
          trigger-class="settings-trigger"
          panel-class="settings-panel"
          align="right"
          :arrow="false"
          :aria-label="t('menu.settings')"
        >
          <template #label><span aria-hidden="true">⚙</span></template>
          <template #default="{ close }">
            <button class="menu-item" @click="showSettings = true; close()">{{ t('menu.fields') }}</button>
            <div class="menu-row">
              <span>{{ t('menu.theme') }}</span>
              <div class="seg" role="group" :aria-label="t('menu.theme')">
                <button
                  v-for="choice in ['system', 'light', 'dark']"
                  :key="choice"
                  :class="{ active: themeChoice === choice }"
                  :aria-pressed="themeChoice === choice"
                  @click="themeChoice = choice"
                >{{ t(`theme.${choice}`) }}</button>
              </div>
            </div>
            <div class="menu-row">
              <span>{{ t('menu.language') }}</span>
              <LanguageSwitch />
            </div>
          </template>
        </MenuButton>
      </div>
    </div>
  </header>

  <main id="main" tabindex="-1">
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

      <TodayPanel
        v-if="loaded && !hasFilters"
        :items="items"
        :due="due"
        @open="(id) => (detailId = id)"
        @show-due="dueOnly = true"
        @show-waiting="waitingOnly = true"
      />

      <FilterBar
        v-model:search="search"
        v-model:status="statusFilter"
        v-model:favorite="favoriteOnly"
        v-model:tag="tagFilter"
        v-model:kind="kindFilter"
        v-model:group="groupByCompany"
        v-model:due="dueOnly"
        v-model:waiting="waitingOnly"
        :stats="stats"
        :total="total"
        :shown="visibleItems.length"
        :show-group="view === 'list'"
      />

      <p v-if="error && !backendDown" class="error">{{ error }}</p>

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
      <div v-else-if="!loaded" class="skeleton" role="status" aria-busy="true" :aria-label="t('state.loading')">
        <i v-for="n in 8" :key="n"></i>
      </div>
      <div v-else-if="backendDown" class="state failed" role="alert">
        <Icon name="rejected" />
        <h2>{{ t('state.downTitle') }}</h2>
        <p>{{ t('state.downText') }}</p>
        <div class="state-actions"><button @click="load">{{ t('state.retry') }}</button></div>
      </div>
      <div v-else-if="hasFilters" class="state">
        <Icon name="unsure" />
        <h2>{{ t('state.noHitsTitle') }}</h2>
        <p>{{ t('state.noHitsText') }}</p>
        <div class="state-actions"><button @click="clearFilters">{{ t('state.reset') }}</button></div>
      </div>
      <div v-else-if="!error" class="state">
        <Icon name="planned" />
        <h2>{{ t('state.emptyTitle') }}</h2>
        <p>{{ t('state.emptyText') }}</p>
        <div class="state-actions">
          <button class="primary" @click="openNew">{{ t('app.new') }}</button>
          <button @click="showImport = true">{{ t('menu.import') }}</button>
        </div>
      </div>
    </template>

    <button class="primary fab" :aria-label="t('app.new')" @click="openNew">+ {{ t('app.new') }}</button>

    <DetailModal
      v-if="detail"
      :item="detail"
      :number="detailNumber"
      :index="detailIndex"
      :count="visibleItems.length"
      :kinds="kindKeys"
      @close="detailId = null"
      @edit="editFromDetail"
      @remove="remove"
      @changed="load"
      @status="changeStatus"
      @kind="changeKind"
      @update="updateItem"
      @favorite="toggleFavorite"
      @prev="stepDetail(-1)"
      @next="stepDetail(1)"
      @duplicate="duplicate"
    />
    <QuickAddDialog
      v-if="quickAdd"
      :error="errorText"
      :companies="companies"
      :kinds="kindKeys"
      @save="(data) => save(null, data)"
      @expand="expandQuick"
      @close="closeForm"
    />
    <ApplicationForm v-if="editing" :item="editing" :error="errorText" :companies="companies" :kinds="kindKeys" @save="save" @close="closeForm" />
    <FieldSettings v-if="showSettings" @close="showSettings = false" />
    <InboxDialog v-if="inboxFiles" :companies="companies" :files="inboxFiles" @close="inboxFiles = null" @done="inboxDone" />
    <div v-if="fileDrag" class="page-drop" aria-hidden="true"><span>{{ t('inbox.dropOverlay') }}</span></div>
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
