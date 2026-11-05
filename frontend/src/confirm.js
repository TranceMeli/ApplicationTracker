import { ref } from 'vue'

// Replacement for window.confirm(): shows the ConfirmDialog and resolves to true or false.
export const confirmState = ref(null)

export function askConfirm(message) {
  return new Promise((resolve) => {
    confirmState.value?.resolve(false) // only one question at a time
    confirmState.value = { message, resolve }
  })
}

export function answerConfirm(answer) {
  const state = confirmState.value
  confirmState.value = null
  state?.resolve(answer)
}
