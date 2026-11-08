<script setup>
import { computed, ref, watch } from 'vue'
import { STATUS_KEYS, fmt, isDue } from '../constants'
import { visibleTableFields } from '../fields'
import { t } from '../i18n'
import CompanyLogo from './CompanyLogo.vue'
import KindBadge from './KindBadge.vue'
import Icon from './Icon.vue'
import MenuButton from './MenuButton.vue'
import { kindName } from '../kind'

const props = defineProps({ items: Array, selected: { type: Array, default: () => [] }, group: Boolean })
const emit = defineEmits(['open', 'edit', 'remove', 'status', 'favorite', 'select'])

const SORT_KEY = 'tracker.sort'

function loadSort() {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_KEY))
    if (s && typeof s.key === 'string' && (s.dir === 'asc' || s.dir === 'desc')) return s
  } catch {}
  return { key: '', dir: 'asc' }
}

// Click on a column header: ascending, then descending, then back to the numbering order.
const sort = ref(loadSort())
watch(sort, (value) => {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(value))
  } catch {}
}, { deep: true })

function toggleSort(key) {
  if (sort.value.key !== key) sort.value = { key, dir: 'asc' }
  else if (sort.value.dir === 'asc') sort.value = { key, dir: 'desc' }
  else sort.value = { key: '', dir: 'asc' }
}

const companyKey = (name) => (name || '').replace(/\s+/g, ' ').trim().toLowerCase()

// The number stays with the application, whatever the order on screen is.
const numbers = computed(() => new Map(props.items.map((item, index) => [item.id, index + 1])))

const counts = computed(() => {
  const map = new Map()
  for (const i of props.items) map.set(companyKey(i.company), (map.get(companyKey(i.company)) ?? 0) + 1)
  return map
})

function sortValue(field, item) {
  if (field.key === 'id') return item.id
  if (field.key === 'status') return STATUS_KEYS.indexOf(item.status)
  if (field.key === 'kind') return kindName(item.kind).toLowerCase()
  const value = item[field.key]
  return value === null || value === undefined ? '' : String(value).toLowerCase()
}

function compare(a, b, field, dir) {
  const x = sortValue(field, a)
  const y = sortValue(field, b)
  if (x === '' && y === '') return 0
  if (x === '') return 1 // empty values stay at the end in both directions
  if (y === '') return -1
  const result = typeof x === 'number' ? x - y : x.localeCompare(y, undefined, { numeric: true })
  return dir === 'asc' ? result : -result
}

const rows = computed(() => {
  const list = [...props.items]
  const field = visibleTableFields.value.find((f) => f.key === sort.value.key)
  if (field) list.sort((a, b) => compare(a, b, field, sort.value.dir) || a.id - b.id)
  if (props.group) {
    const order = [...new Set(list.map((i) => companyKey(i.company)))].sort((a, b) => a.localeCompare(b))
    list.sort((a, b) => order.indexOf(companyKey(a.company)) - order.indexOf(companyKey(b.company)))
  }
  const out = []
  let last = null
  for (const item of list) {
    const key = companyKey(item.company)
    if (props.group && counts.value.get(key) > 1 && key !== last) {
      out.push({ type: 'group', key: `g-${key}`, company: item.company, n: counts.value.get(key) })
    }
    last = key
    out.push({ type: 'row', key: item.id, item })
  }
  return out
})

const columnCount = computed(() => visibleTableFields.value.length + 3)

const overdue = isDue
const tagsOf = (i) => (i.tags ? i.tags.split(', ') : [])

const visibleIds = computed(() => rows.value.filter((r) => r.type === 'row').map((r) => r.item.id))
const allSelected = computed(() => visibleIds.value.length > 0 && visibleIds.value.every((id) => props.selected.includes(id)))

function toggle(id) {
  emit('select', props.selected.includes(id) ? props.selected.filter((x) => x !== id) : [...props.selected, id])
}
const toggleAll = () => emit('select', allSelected.value ? [] : visibleIds.value)

const ariaSort = (key) => (sort.value.key === key ? (sort.value.dir === 'asc' ? 'ascending' : 'descending') : 'none')
const arrow = (key) => (sort.value.key === key ? (sort.value.dir === 'asc' ? ' ▲' : ' ▼') : '')
</script>

<template>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th class="sel">
            <input type="checkbox" :checked="allSelected" :aria-label="t('bulk.selectAll')" @change="toggleAll" />
          </th>
          <th></th>
          <th v-for="f in visibleTableFields" :key="f.key" :aria-sort="ariaSort(f.key)">
            <button class="sort" :title="t('sort.by', { name: t(f.label) })" @click="toggleSort(f.key)">
              {{ t(f.label) }}{{ arrow(f.key) }}
            </button>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="r in rows" :key="r.key">
          <tr v-if="r.type === 'group'" class="group-row">
            <td :colspan="columnCount">{{ r.company }} · {{ t('group.count', { n: r.n }) }}</td>
          </tr>
          <tr
            v-else
            :class="[r.item.status, { picked: selected.includes(r.item.id) }]"
            @click="$emit('open', r.item)"
          >
            <td class="sel" @click.stop>
              <input
                type="checkbox"
                :checked="selected.includes(r.item.id)"
                :aria-label="t('bulk.select')"
                @change="toggle(r.item.id)"
              />
            </td>
            <td class="fav" @click.stop>
              <button
                class="star"
                :class="{ on: r.item.is_favorite }"
                :aria-label="r.item.is_favorite ? t('fav.remove') : t('fav.add')"
                @click="$emit('favorite', r.item)"
              >{{ r.item.is_favorite ? '★' : '☆' }}</button>
            </td>

            <td
              v-for="f in visibleTableFields"
              :key="f.key"
              :class="{ overdue: f.key === 'follow_up' && overdue(r.item), clip: f.type === 'textarea' }"
            >
              <template v-if="f.key === 'id'">{{ numbers.get(r.item.id) }}</template>
              <div v-else-if="f.key === 'company'" class="company-cell">
                <div class="company">
                  <CompanyLogo :item="r.item" />
                  <button type="button" class="row-open name" :title="t('row.open')">{{ r.item.company }}</button>
                  <a v-if="r.item.link" class="ext" :href="r.item.link" target="_blank" rel="noopener" :aria-label="t('row.openLink', { name: r.item.company })" :title="t('row.openLink', { name: r.item.company })" @click.stop><Icon name="external" /></a>
                  <span v-if="!group && counts.get(companyKey(r.item.company)) > 1" class="same" :title="t('group.count', { n: counts.get(companyKey(r.item.company)) })">
                    ×{{ counts.get(companyKey(r.item.company)) }}
                  </span>
                </div>
                <div v-if="tagsOf(r.item).length" class="tags">
                  <span v-for="tag in tagsOf(r.item)" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
              <span v-else-if="f.key === 'status'" class="status-cell" :class="r.item.status">
                <Icon :name="r.item.status" />
                <select
                  class="badge"
                  :class="r.item.status"
                  :value="r.item.status"
                  :aria-label="t('field.status')"
                  @click.stop
                  @change="$emit('status', r.item, $event.target.value)"
                >
                  <option v-for="key in STATUS_KEYS" :key="key" :value="key">{{ t(`status.${key}`) }}</option>
                </select>
              </span>
              <template v-else-if="f.key === 'kind'">
                <KindBadge v-if="r.item.kind" :item="r.item" />
                <template v-else>–</template>
              </template>
              <a v-else-if="f.type === 'email' && r.item.email" :href="`mailto:${r.item.email}`" @click.stop>{{ r.item.email }}</a>
              <a v-else-if="f.type === 'url' && r.item[f.key]" :href="r.item[f.key]" target="_blank" rel="noopener" @click.stop>↗</a>
              <template v-else-if="f.type === 'date'">
                <template v-if="f.key === 'follow_up' && overdue(r.item)"><Icon name="clock" />{{ fmt(r.item[f.key]) }} · {{ t('due.overdue') }}</template>
                <template v-else>{{ fmt(r.item[f.key]) }}</template>
              </template>
              <template v-else-if="f.type === 'select'">
                {{ r.item[f.key] ? t(`${f.optionsPrefix}.${r.item[f.key]}`) : '–' }}
              </template>
              <template v-else>{{ r.item[f.key] || '–' }}</template>
            </td>

            <td class="actions row-menu" @click.stop>
              <MenuButton :aria-label="t('row.menu', { name: r.item.company })" :arrow="false" align="right">
                <template #label><span aria-hidden="true">⋯</span></template>
                <template #default="{ close }">
                  <button class="menu-item" @click="$emit('edit', r.item); close()">{{ t('btn.edit') }}</button>
                  <button class="menu-item danger-item" @click="$emit('remove', r.item); close()">{{ t('btn.delete') }}</button>
                </template>
              </MenuButton>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
