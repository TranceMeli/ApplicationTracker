<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { vBackdropClose } from '../backdrop'
import { today } from '../constants'
import { t } from '../i18n'
import { kindClass, kindName } from '../kind'
import { companyFromLink, initials, logoUrl, logosEnabled, normalizeLink } from '../logo'

const props = defineProps({
  error: String,
  companies: { type: Array, default: () => [] },
  kinds: { type: Array, default: () => [] }, // types in use, offered next to Stelle and Initiativ
})
const emit = defineEmits(['save', 'expand', 'close'])

const STATUSES = ['planned', 'applied']

const link = ref('')
const company = ref('')
const position = ref('')
const status = ref('planned')
const kind = ref('')
const companyTouched = ref(false)
const logoFailed = ref(false)

const linkInput = ref(null)
onMounted(() => linkInput.value?.focus())

const normalizedLink = computed(() => normalizeLink(link.value))
const guess = computed(() => companyFromLink(link.value))

// The company is filled in from the link until the user types a name of their own.
watch(guess, (value) => {
  logoFailed.value = false
  if (!companyTouched.value) company.value = value.name
})

const showImage = computed(() => logosEnabled.value && guess.value.domain && !logoFailed.value)
const tileText = computed(() => initials(company.value || guess.value.name))

const hint = computed(() => {
  if (!link.value.trim()) return ''
  return guess.value.name ? t('quick.detected', { domain: guess.value.domain || guess.value.name }) : t('quick.undetected')
})

const normalize = (name) => (name || '').replace(/\s+/g, ' ').trim().toLowerCase()
const duplicates = computed(() => {
  const key = normalize(company.value)
  return key ? props.companies.filter((c) => normalize(c.company) === key) : []
})

const kindChoices = computed(() => ['', ...new Set(props.kinds)])

const data = () => ({
  company: company.value.trim(),
  position: position.value.trim(),
  link: normalizedLink.value,
  status: status.value,
  kind: kind.value,
})

const submit = () => emit('save', { ...data(), date: today() })
</script>

<template>
  <div class="overlay" v-backdrop-close="() => $emit('close')">
    <form class="dialog quick-dialog" @submit.prevent="submit">
      <h2>{{ t('form.new') }}</h2>

      <label>
        {{ t('field.link') }}
        <input
          ref="linkInput"
          v-model="link"
          type="text"
          inputmode="url"
          autocomplete="off"
          placeholder="https://"
        />
      </label>

      <div class="company-row">
        <span class="logo large quick-logo" :class="{ initials: !showImage }" aria-hidden="true">
          <img v-if="showImage" :src="logoUrl(guess.domain)" alt="" @error="logoFailed = true" />
          <template v-else>{{ tileText }}</template>
        </span>
        <label>
          {{ t('field.company') }}
          <input v-model="company" type="text" required autocomplete="off" @input="companyTouched = true" />
        </label>
      </div>
      <p v-if="hint" class="sub quick-hint">{{ hint }}</p>
      <p v-if="duplicates.length" class="notice">
        {{ t('form.duplicate', { name: duplicates[0].company, n: duplicates[0].id }) }}
      </p>

      <label>
        {{ t('field.position') }}
        <input v-model="position" type="text" autocomplete="off" />
      </label>

      <div class="quick-choices">
        <div>
          <span class="choice-label">{{ t('field.status') }}</span>
          <div class="seg" role="group" :aria-label="t('field.status')">
            <button
              v-for="s in STATUSES"
              :key="s"
              type="button"
              :class="{ active: status === s }"
              :aria-pressed="status === s"
              @click="status = s"
            >{{ t(`status.${s}`) }}</button>
          </div>
        </div>
        <div>
          <span class="choice-label">{{ t('field.kind') }}</span>
          <div class="seg" role="group" :aria-label="t('field.kind')">
            <button
              v-for="k in kindChoices"
              :key="k"
              type="button"
              :class="[{ active: kind === k }, kindClass(k)]"
              :aria-pressed="kind === k"
              @click="kind = k"
            >{{ k === '' ? '–' : kindName(k) }}</button>
          </div>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="quick-actions">
        <button type="button" class="link" @click="$emit('expand', data())">{{ t('quick.moreFields') }}</button>
        <span class="buttons">
          <button type="button" @click="$emit('close')">{{ t('btn.cancel') }}</button>
          <button class="primary" type="submit">{{ t('quick.add') }}</button>
        </span>
      </div>
    </form>
  </div>
</template>
