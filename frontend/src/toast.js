import { ref } from 'vue'

// One short message at the bottom of the page, optionally with an action such as "Undo".
export const toast = ref(null)

let timer

export function dismissToast() {
  clearTimeout(timer)
  toast.value = null
}

export function showToast(message, { actionLabel = '', onAction = null, ms = 8000 } = {}) {
  clearTimeout(timer)
  toast.value = { message, actionLabel, onAction }
  timer = setTimeout(dismissToast, ms)
}
