<script setup>
import { computed, reactive, ref } from 'vue'
import { geocodePending, home, lookupAddress, setHome } from '../geo'
import { t } from '../i18n'

const props = defineProps({ items: Array })
const emit = defineEmits(['changed'])

const editing = ref(false)
const form = reactive({ street: '', postal_code: '', city: '' })
const homeBusy = ref(false)
const homeError = ref('')

const batch = reactive({ running: false, done: 0, total: 0, message: '', error: '' })

const open = computed(() => props.items.filter((i) => !i.geo_precision).length)
const unplaced = computed(() => props.items.filter((i) => i.geo_precision === 'failed').length)

const homeText = computed(() =>
  home.value
    ? [home.value.street, [home.value.postal_code, home.value.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : '',
)

function edit() {
  Object.assign(form, { street: '', postal_code: '', city: '' }, home.value ?? {})
  homeError.value = ''
  editing.value = true
}

async function saveHome() {
  homeBusy.value = true
  homeError.value = ''
  try {
    const hit = await lookupAddress({ ...form })
    setHome({ ...form, latitude: hit.latitude, longitude: hit.longitude })
    editing.value = false
  } catch (e) {
    homeError.value = t(e.message === 'not_found' ? 'geo.homeNotFound' : 'geo.unreachable')
  } finally {
    homeBusy.value = false
  }
}

async function lookupAll(retry = false) {
  Object.assign(batch, { running: true, done: 0, total: 0, message: '', error: '' })
  try {
    for (;;) {
      const res = await geocodePending(retry)
      retry = false
      batch.done += res.processed
      batch.total = batch.done + res.remaining
      emit('changed') // show new markers while the lookup is still running
      if (res.remaining === 0 || res.processed === 0) break
    }
    batch.message = t('geo.finished')
  } catch (e) {
    batch.error = t('geo.unreachable')
  } finally {
    batch.running = false
  }
}
</script>

<template>
  <section class="geo-bar">
    <div class="geo-home">
      <template v-if="!editing">
        <strong>{{ t('geo.home') }}:</strong>
        <span v-if="home">{{ homeText }}</span>
        <span v-else class="sub">{{ t('geo.homeNotSet') }}</span>
        <button type="button" @click="edit">{{ t(home ? 'geo.change' : 'geo.set') }}</button>
        <button v-if="home" type="button" @click="setHome(null)">{{ t('geo.remove') }}</button>
      </template>

      <form v-else class="geo-form" @submit.prevent="saveHome">
        <label>{{ t('field.street') }}<input v-model="form.street" autocomplete="street-address" /></label>
        <label class="narrow">{{ t('field.postalCode') }}<input v-model="form.postal_code" autocomplete="postal-code" /></label>
        <label>{{ t('field.city') }}<input v-model="form.city" autocomplete="address-level2" /></label>
        <button type="submit" class="primary" :disabled="homeBusy || !(form.city || form.postal_code)">
          {{ homeBusy ? t('geo.looking') : t('geo.save') }}
        </button>
        <button type="button" :disabled="homeBusy" @click="editing = false">{{ t('btn.cancel') }}</button>
        <p v-if="homeError" class="error wide">{{ homeError }}</p>
      </form>
    </div>

    <div class="geo-lookup">
      <button type="button" :disabled="batch.running" @click="lookupAll()">
        {{ batch.running ? t('geo.progress', { done: batch.done, total: batch.total || '…' }) : t('geo.lookup') }}
      </button>
      <span v-if="!batch.running && open" class="sub">{{ t('geo.pending', { n: open }) }}</span>
      <span v-if="!batch.running && !open && unplaced" class="sub">
        {{ t('geo.unplaced', { n: unplaced }) }}
        <button type="button" class="link" @click="lookupAll(true)">{{ t('geo.retry') }}</button>
      </span>
      <span v-if="batch.message && !batch.running" class="sub">{{ batch.message }}</span>
      <span v-if="batch.error" class="error-text">{{ batch.error }}</span>
    </div>

    <p class="sub geo-privacy">{{ t('geo.privacy') }}</p>
  </section>
</template>