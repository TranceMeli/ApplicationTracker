<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { vBackdropClose } from '../backdrop'
import { today } from '../constants'
import { t } from '../i18n'
import { kindClass, kindName } from '../kind'
import { clearDraft, loadDraft, saveDraft } from '../draft'
import { companyFromLink, initials, logoUrl, logosEnabled, normalizeLink } from '../logo'
import { useUnsaved } from '../unsaved'
import { checkCompany, checkLink } from '../validate'
import DiscardGuard from './DiscardGuard.vue'

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
const companyInput = ref(null)

// Entries of an earlier, unfinished try come back. They count as unsaved, so closing asks first.
const restored = ref(false)
const draft = loadDraft()
if (draft && (draft.company || draft.link || draft.position)) {
  link.value = draft.link ?? ''
  company.value = draft.company ?? ''
  position.value = draft.position ?? ''
  if (STATUSES.includes(draft.status)) status.value = draft.status
  kind.value = draft.kind ?? ''
  companyTouched.value = !!draft.company
  restored.value = true
}
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

// Errors are shown at the field and go away when the field is edited.
const errors = ref({ company: '', link: '' })
watch(company, () => (errors.value.company = ''))
watch(link, () => (errors.value.link = ''))
const checkLinkField = () => (errors.value.link = checkLink(link.value))

async function submit() {
  errors.value = { company: checkCompany(company.value), link: checkLink(link.value) }
  if (errors.value.link) return linkInput.value?.focus()
  if (errors.value.company) {
    await nextTick()
    return companyInput.value?.focus()
  }
  emit('save', { ...data(), date: today() })
}

// The draft is kept while typing. It is removed when the application is saved (by the app) or discarded here.
const pristine = () => !link.value.trim() && !company.value.trim() && !position.value.trim()
const draftState = ref(restored.value ? 'restored' : '')
let draftTimer
watch([link, company, position, status, kind], () => {
  clearTimeout(draftTimer)
  draftState.value = 'saving'
  draftTimer = setTimeout(() => {
    if (pristine()) { clearDraft(); draftState.value = '' } else { saveDraft(data()); draftState.value = 'saved' }
  }, 400)
})

const { asking, request, keep } = useUnsaved(() => !pristine(), () => emit('close'))
function discard() {
  clearTimeout(draftTimer)
  clearDraft()
  emit('close')
}
</script>

<template>
  <div class="overlay" v-backdrop-close="request">
    <form class="dialog quick-dialog" novalidate @submit.prevent="submit">
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
          :aria-invalid="errors.link ? 'true' : undefined"
          :aria-describedby="errors.link ? 'quick-link-error' : undefined"
          @blur="checkLinkField"
        />
        <small v-if="errors.link" id="quick-link-error" class="field-error" role="alert">{{ t(errors.link) }}</small>
      </label>

      <div class="company-row">
        <span class="logo large quick-logo" :class="{ initials: !showImage }" aria-hidden="true">
          <img v-if="showImage" :src="logoUrl(guess.domain)" alt="" @error="logoFailed = true" />
          <template v-else>{{ tileText }}</template>
        </span>
        <label>
          {{ t('field.company') }} *
          <input
            ref="companyInput"
            v-model="company"
            type="text"
            aria-required="true"
            autocomplete="off"
            :aria-invalid="errors.company ? 'true' : undefined"
            :aria-describedby="errors.company ? 'quick-company-error' : undefined"
            @input="companyTouched = true"
          />
          <small v-if="errors.company" id="quick-company-error" class="field-error" role="alert">{{ t(errors.company) }}</small>
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
          <button type="button" @click="request">{{ t('btn.cancel') }}</button>
          <button class="primary" type="submit">{{ t('quick.add') }}</button>
        </span>
      </div>
      <p class="draft-note" role="status">
        <template v-if="draftState === 'restored'">{{ t('draft.restored') }}</template>
        <template v-else-if="draftState === 'saving'">{{ t('draft.saving') }}</template>
        <template v-else-if="draftState === 'saved'">{{ t('draft.saved') }}</template>
        <template v-else>{{ t('draft.auto') }}</template>
      </p>
      <DiscardGuard v-if="asking" @keep="keep" @discard="discard" />
    </form>
  </div>
</template>
