<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { distanceLabel, hasCoords, home } from '../geo'
import { t } from '../i18n'

const props = defineProps({ items: Array })
const emit = defineEmits(['open'])

const mapEl = ref(null)
let map
let layer
let line
let lastFit = ''

// Same status colors as in style.css (--planned, --unsure, ...). Planned is a white dot with a dark ring.
const COLORS = {
  planned: '#FFFFFF',
  unsure: '#8F6BC4',
  applied: '#2F7BE0',
  interview: '#F0A020',
  rejected: '#D6453D',
  offer: '#2F8A3E',
}

const placed = computed(() => props.items.filter(hasCoords))
const unplacedCount = computed(() => props.items.length - placed.value.length)

// Companies that share the same coordinates (for example everyone known only by town)
// are spread on a small spiral, so that every marker can be clicked. Distances use the real position.
function spread(list) {
  const groups = new Map()
  for (const item of list) {
    const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  const out = []
  for (const group of groups.values()) {
    group.forEach((item, n) => {
      const angle = n * 2.399963
      const radius = n === 0 ? 0 : 0.0012 * Math.sqrt(n)
      out.push({
        item,
        latlng: [
          item.latitude + radius * Math.sin(angle),
          item.longitude + (radius * Math.cos(angle)) / Math.cos((item.latitude * Math.PI) / 180),
        ],
      })
    })
  }
  return out
}

// Leaflet treats a string as HTML, so labels are passed as text nodes instead.
function textNode(text) {
  const el = document.createElement('span')
  el.textContent = text
  return el
}

function popupFor(item) {
  // Built with DOM nodes and textContent, so company names can never inject markup.
  const box = document.createElement('div')
  box.className = 'map-popup'
  const add = (tag, text, className) => {
    const el = document.createElement(tag)
    el.textContent = text
    if (className) el.className = className
    box.appendChild(el)
    return el
  }
  add('strong', item.company)
  if (item.position) add('div', item.position)
  add('div', t(`status.${item.status}`), 'sub')
  const address = [item.street, [item.postal_code, item.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (address) add('div', address, 'sub')
  if (item.geo_precision === 'city') add('div', t('geo.approx'), 'sub')
  const distance = distanceLabel(item)
  if (distance) add('div', distance, 'sub')
  const button = add('button', t('geo.details'))
  button.type = 'button'
  button.addEventListener('click', () => emit('open', item))
  return box
}

function draw() {
  if (!map) return
  layer.clearLayers()
  line?.remove()
  line = null

  const points = []
  for (const { item, latlng } of spread(placed.value)) {
    const marker = L.circleMarker(latlng, {
      radius: 8,
      weight: item.geo_precision === 'city' ? 2 : 1.5,
      color: '#1F2328',
      dashArray: item.geo_precision === 'city' ? '3 3' : null,
      fillColor: COLORS[item.status] ?? COLORS.planned,
      fillOpacity: item.geo_precision === 'city' ? 0.55 : 0.9,
    }).bindPopup(() => popupFor(item), { minWidth: 160 })
    marker.bindTooltip(textNode(item.company))
    marker.on('popupopen', () => {
      line?.remove()
      if (home.value) {
        line = L.polyline([[home.value.latitude, home.value.longitude], [item.latitude, item.longitude]], {
          color: '#1F2328',
          weight: 2,
          dashArray: '6 6',
        }).addTo(map)
      }
    })
    marker.on('popupclose', () => {
      line?.remove()
      line = null
    })
    marker.addTo(layer)
    points.push(latlng)
  }

  if (home.value) {
    const icon = L.divIcon({ className: 'home-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
    L.marker([home.value.latitude, home.value.longitude], { icon, zIndexOffset: 1000, title: t('geo.home'), keyboard: false })
      .bindTooltip(textNode(t('geo.home')))
      .addTo(layer)
    points.push([home.value.latitude, home.value.longitude])
  }

  // Only re-centre when the set of points changes, not after every status edit.
  const fit = points.map((p) => p.join(',')).join(';')
  if (fit !== lastFit) {
    lastFit = fit
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    else if (points.length === 1) map.setView(points[0], 13)
    else map.setView([51.1, 10.4], 6)
  }
}

onMounted(() => {
  map = L.map(mapEl.value, { scrollWheelZoom: false })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  draw()
})
onBeforeUnmount(() => map?.remove())

watch(() => [props.items, home.value], draw)
</script>

<template>
  <div>
    <div ref="mapEl" class="map" role="region" :aria-label="t('view.map')"></div>
    <p v-if="unplacedCount" class="sub map-note">{{ t('geo.notOnMap', { n: unplacedCount }) }}</p>
    <ul class="legend" aria-hidden="true">
      <li><span class="dot home"></span>{{ t('geo.home') }}</li>
      <li v-for="(color, key) in COLORS" :key="key"><span class="dot" :style="{ background: color }"></span>{{ t(`status.${key}`) }}</li>
      <li><span class="dot approx"></span>{{ t('geo.approx') }}</li>
    </ul>
  </div>
</template>