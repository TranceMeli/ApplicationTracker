import { computed, reactive, watch } from 'vue'
import { STATUS_KEYS } from './constants'

export const CHANNEL_KEYS = ['email', 'portal', 'post', 'phone', 'personal']
export const WORK_MODE_KEYS = ['onsite', 'hybrid', 'remote']

// Order here = column order in the table and field order in the form.
// locked: always visible | tableable: can be a table column | formable: false = not in form
export const FIELDS = [
  { key: 'id', label: 'table.nr', tableable: true, defaultTable: true, formable: false },
  { key: 'date', label: 'field.date', type: 'date', tableable: true, defaultTable: true },
  { key: 'company', label: 'field.company', type: 'text', locked: true, required: true, tableable: true },
  { key: 'position', label: 'field.position', type: 'text', tableable: true, defaultTable: true },
  { key: 'contact_person', label: 'field.contactPerson', type: 'text', tableable: true, defaultTable: true },
  { key: 'email', label: 'field.email', type: 'email', tableable: true, defaultTable: true },
  { key: 'phone', label: 'field.phone', type: 'tel', tableable: true },
  { key: 'follow_up', label: 'field.followUp', type: 'date', tableable: true, defaultTable: true },
  { key: 'interview_date', label: 'field.interviewDate', type: 'date', tableable: true },
  { key: 'response_date', label: 'field.responseDate', type: 'date', tableable: true },
  { key: 'source', label: 'field.source', type: 'text', tableable: true },
  { key: 'channel', label: 'field.channel', type: 'select', options: CHANNEL_KEYS, optionsPrefix: 'channel', tableable: true },
  { key: 'work_mode', label: 'field.workMode', type: 'select', options: WORK_MODE_KEYS, optionsPrefix: 'workmode', tableable: true },
  { key: 'salary', label: 'field.salary', type: 'text', tableable: true },
  { key: 'street', label: 'field.street', type: 'text', wide: true, autocomplete: 'street-address' },
  { key: 'postal_code', label: 'field.postalCode', type: 'text', inputmode: 'numeric', maxlength: 10, autocomplete: 'postal-code' },
  { key: 'city', label: 'field.city', type: 'text', autocomplete: 'address-level2', tableable: true },
  { key: 'status', label: 'field.status', type: 'select', options: STATUS_KEYS, optionsPrefix: 'status', locked: true, tableable: true, defaultTable: true },
  { key: 'link', label: 'field.link', type: 'url', wide: true, tableable: true },
  { key: 'rejection_reason', label: 'field.rejectionReason', type: 'textarea', wide: true },
  { key: 'notes', label: 'field.notes', type: 'textarea', wide: true },
]

const KEY = 'fieldSettings'

const defaults = () => ({
  table: FIELDS.filter((f) => f.defaultTable).map((f) => f.key),
  form: FIELDS.filter((f) => f.formable !== false).map((f) => f.key),
})

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (Array.isArray(s?.table) && Array.isArray(s?.form)) return s
  } catch {}
  return defaults()
}

export const settings = reactive(load())
watch(settings, () => localStorage.setItem(KEY, JSON.stringify(settings)), { deep: true })
export const resetSettings = () => Object.assign(settings, defaults())

export const TABLE_FIELDS = FIELDS.filter((f) => f.tableable)
export const FORM_FIELDS = FIELDS.filter((f) => f.formable !== false)

export const visibleTableFields = computed(() =>
  TABLE_FIELDS.filter((f) => f.locked || settings.table.includes(f.key)),
)
export const visibleFormFields = computed(() =>
  FORM_FIELDS.filter((f) => f.locked || settings.form.includes(f.key)),
)