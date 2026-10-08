'use client'
import { useEffect } from 'react'

/** Keep keyboard navigation inside the active dialog and restore its trigger. */
export default function useCommercialDialog(
  open: boolean,
  close: () => void,
  busy = false,
) {
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>(
      '.commercial-overlay [role="dialog"]',
    )
    if (!dialog) return
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], iframe, [tabindex="0"]',
        ),
      ).filter((el) => !el.hasAttribute('hidden'))
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        close()
      }
      if (event.key !== 'Tab') return
      const items = focusable(),
        first = items[0],
        last = items[items.length - 1]
      if (!first) {
        event.preventDefault()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [open, busy, close])
}
