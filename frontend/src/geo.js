import { ref } from 'vue'
import { t } from './i18n'

const HOME_KEY = 'tracker.home'
const VIEW_KEY = 'tracker.view'

// The user's own address. It stays in this browser and is never saved on the server.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}
function write(key, value) {
  try {
    value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage may be blocked, the app still works for this session */
  }
}

// { street, postal_code, city, latitude, longitude } or null
export const home = ref(read(HOME_KEY))
export function setHome(value) {
  home.value = value
  write(HOME_KEY, value)
}

export const VIEWS = ['list', 'cards', 'map']
export function loadView() {
  const view = read(VIEW_KEY)
  return VIEWS.includes(view) ? view : 'list'
}
export const saveView = (view) => write(VIEW_KEY, view)

async function post(url, body = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.code || `HTTP ${response.status}`), { data })
  return data
}

export const lookupAddress = (address) => post('/api/geocode/', address)
export const geocodePending = (retry = false) => post('/api/applications/geocode/', retry ? { retry: '1' } : {})

export const hasCoords = (item) => item.latitude != null && item.longitude != null

// Straight-line distance in kilometres (haversine formula).
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// "12 km" with a localized decimal mark, "ca." when only the town is known.
export function distanceLabel(item, from = home.value) {
  if (!from || !hasCoords(item)) return ''
  const km = distanceKm(from, item)
  const n = km.toLocaleString(t('geo.numberLocale'), { maximumFractionDigits: km < 10 ? 1 : 0 })
  return t(item.geo_precision === 'address' ? 'geo.distance' : 'geo.distanceApprox', { n })
}