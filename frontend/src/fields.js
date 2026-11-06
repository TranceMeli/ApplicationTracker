import { computed, reactive, watch } from 'vue'
import { STATUS_KEYS } from './constants'

export const CHANNEL_KEYS = ['email', 'portal', 'post', 'phone', 'personal']
export const WORK_MODE_KEYS = ['onsite', 'hybrid', 'remote']

// Order here = column order in the table and field order in the form.
// locked: always visible | tableable: can be a table column | formable: false = not in form
// group: the section of the detail view the field belongs to by default (fields without one are in its header)
export const FIELDS = [
  { key: 'id', label: 'table.nr', tableable: true, defaultTable: true, formable: false },
  { key: 'date', group: 'dates', label: 'field.date', type: 'date', tableable: true, defaultTable: true },
  { key: 'company', label: 'field.company', type: 'text', locked: true, required: true, tableable: true },
  { key: 'position', label: 'field.position', type: 'text', tableable: true, defaultTable: true },
  { key: 'contact_person', group: 'contact', label: 'field.contactPerson', type: 'text', tableable: true, defaultTable: true },
  { key: 'email', group: 'contact', label: 'field.email', type: 'email', tableable: true, defaultTable: true },
  { key: 'phone', group: 'contact', label: 'field.phone', type: 'tel', tableable: true },
  { key: 'follow_up', group: 'dates', label: 'field.followUp', type: 'date', tableable: true, defaultTable: true },
  { key: 'interview_date', group: 'dates', label: 'field.interviewDate', type: 'date', tableable: true },
  { key: 'response_date', group: 'dates', label: 'field.responseDate', type: 'date', tableable: true },
  { key: 'source', group: 'other', label: 'field.source', type: 'text', tableable: true },
  { key: 'channel', group: 'other', label: 'field.channel', type: 'select', options: CHANNEL_KEYS, optionsPrefix: 'channel', tableable: true },
  { key: 'work_mode', group: 'terms', label: 'field.workMode', type: 'select', options: WORK_MODE_KEYS, optionsPrefix: 'workmode', tableable: true },
  { key: 'salary', group: 'terms', label: 'field.salary', type: 'text', tableable: true },
  { key: 'street', group: 'place', label: 'field.street', type: 'text', wide: true, autocomplete: 'street-address' },
  { key: 'postal_code', group: 'place', label: 'field.postalCode', type: 'text', inputmode: 'numeric', maxlength: 10, autocomplete: 'postal-code' },
  { key: 'city', group: 'place', label: 'field.city', type: 'text', autocomplete: 'address-level2', tableable: true },
  { key: 'status', label: 'field.status', type: 'select', options: STATUS_KEYS, optionsPrefix: 'status', noEmpty: true, locked: true, tableable: true, defaultTable: true },
  { key: 'kind', label: 'field.kind', type: 'text', tableable: true, defaultTable: true },
  { key: 'link', group: 'other', label: 'field.link', type: 'url', wide: true, tableable: true },
  { key: 'tags', group: 'other', label: 'field.tags', type: 'text', wide: true, placeholder: 'field.tagsHint' },
  { key: 'rejection_reason', group: 'notes', label: 'field.rejectionReason', type: 'textarea', wide: true },
  { key: 'notes', group: 'notes', label: 'field.notes', type: 'textarea', wide: true },
]

// The sections of the detail view. Users can reorder them, move fields between them and add sections of their own.
export const GROUPS = ['contact', 'dates', 'place', 'terms', 'other', 'notes']

const defaultLayout = () =>
  GROUPS.map((id) => ({ id, fields: FIELDS.filter((f) => f.group === id).map((f) => f.key) }))

// Brings a stored layout in line with the field catalog: unknown fields are dropped, built-in sections that
// are missing come back and fields that are in no section (for example new ones) go to their default section.
function sanitizeLayout(layout) {
  const known = new Set(FIELDS.filter((f) => f.group).map((f) => f.key))
  const placed = new Set()
  const sections = (Array.isArray(layout) ? layout : [])
    .filter((section) => section && typeof section.id === 'string' && Array.isArray(section.fields))
    .map((section) => ({
      id: section.id,
      ...(section.name ? { name: String(section.name) } : {}),
      fields: section.fields.filter((key) => known.has(key) && !placed.has(key) && (placed.add(key), true)),
    }))
  for (const id of GROUPS) if (!sections.some((section) => section.id === id)) sections.push({ id, fields: [] })
  for (const f of FIELDS.filter((f) => f.group && !placed.has(f.key))) {
    sections.find((section) => section.id === f.group).fields.push(f.key)
  }
  return sections
}

const KEY = 'fieldSettings'

const defaults = () => ({
  table: FIELDS.filter((f) => f.defaultTable).map((f) => f.key),
  form: FIELDS.filter((f) => f.formable !== false).map((f) => f.key),
  seen: FIELDS.map((f) => f.key),
  layout: defaultLayout(),
  hideEmpty: true, // empty fields are left out of the detail view and offered as "+ field"
})

// Fields added in a later version of the app are switched on once (in the form and, if they
// are a default column, in the table). Fields that were already known keep the user's choice.
const FIELDS_ADDED_LATER = ['tags', 'kind']

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (Array.isArray(s?.table) && Array.isArray(s?.form)) {
      const seen = Array.isArray(s.seen)
        ? s.seen
        : FIELDS.map((f) => f.key).filter((key) => !FIELDS_ADDED_LATER.includes(key))
      for (const f of FIELDS.filter((f) => !seen.includes(f.key))) {
        if (f.formable !== false) s.form.push(f.key)
        if (f.defaultTable) s.table.push(f.key)
      }
      return { ...s, seen: FIELDS.map((f) => f.key), layout: sanitizeLayout(s.layout), hideEmpty: s.hideEmpty !== false }
    }
  } catch {}
  return defaults()
}

export const settings = reactive(load())
watch(
  settings,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* storage may be blocked, the settings then last for this session */
    }
  },
  { deep: true },
)
export const resetSettings = () => Object.assign(settings, defaults())

export const TABLE_FIELDS = FIELDS.filter((f) => f.tableable)
export const FORM_FIELDS = FIELDS.filter((f) => f.formable !== false)

export const visibleTableFields = computed(() =>
  TABLE_FIELDS.filter((f) => f.locked || settings.table.includes(f.key)),
)
export const visibleFormFields = computed(() =>
  FORM_FIELDS.filter((f) => f.locked || settings.form.includes(f.key)),
)

// The sections of the detail view with their fields, in the order of the layout. Only fields that are switched on
// for the form and the detail view are included.
export const detailSections = computed(() => {
  const visible = new Set(visibleFormFields.value.map((f) => f.key))
  return settings.layout.map((section) => ({
    id: section.id,
    name: section.name,
    fields: section.fields.filter((key) => visible.has(key)).map((key) => FIELDS.find((f) => f.key === key)),
  }))
})

// ---- changes made in the field settings ----
const sectionOf = (key) => settings.layout.find((section) => section.fields.includes(key))

function swap(list, index, direction) {
  const target = index + direction
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
}

export const moveSection = (id, direction) => swap(settings.layout, settings.layout.findIndex((s) => s.id === id), direction)

export function moveField(key, direction) {
  const section = sectionOf(key)
  if (section) swap(section.fields, section.fields.indexOf(key), direction)
}

export function moveFieldTo(key, sectionId) {
  const from = sectionOf(key)
  const to = settings.layout.find((section) => section.id === sectionId)
  if (!from || !to || from === to) return
  from.fields.splice(from.fields.indexOf(key), 1)
  to.fields.push(key)
}

export function addSection(name) {
  const id = `custom-${Date.now().toString(36)}`
  settings.layout.push({ id, name: name.trim(), fields: [] })
  return id
}

export function renameSection(id, name) {
  const section = settings.layout.find((s) => s.id === id)
  if (section && !GROUPS.includes(id)) section.name = name
}

// A section of your own can be deleted, its fields return to their default sections.
export function removeSection(id) {
  const index = settings.layout.findIndex((s) => s.id === id)
  if (index === -1 || GROUPS.includes(id)) return
  const [removed] = settings.layout.splice(index, 1)
  for (const key of removed.fields) {
    const home = settings.layout.find((s) => s.id === FIELDS.find((f) => f.key === key)?.group) ?? settings.layout[0]
    home.fields.push(key)
  }
}
