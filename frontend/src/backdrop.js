// Closes a dialog when the dark backdrop is clicked, but only if the mouse button went down
// on the backdrop too. A plain click handler also fires when text is selected in a field and
// the button is released outside the dialog, which closed the dialog and lost the entries.
export const vBackdropClose = {
  mounted(el, binding) {
    let pressed = false
    el.__backdropClose = binding.value
    el.__backdropDown = (e) => { pressed = e.target === el }
    el.__backdropClick = (e) => {
      if (pressed && e.target === el) el.__backdropClose()
      pressed = false
    }
    el.addEventListener('mousedown', el.__backdropDown)
    el.addEventListener('click', el.__backdropClick)
  },
  updated(el, binding) {
    el.__backdropClose = binding.value
  },
  unmounted(el) {
    el.removeEventListener('mousedown', el.__backdropDown)
    el.removeEventListener('click', el.__backdropClick)
  },
}
