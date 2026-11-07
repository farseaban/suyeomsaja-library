import { it, expect } from 'vitest'
import { refIdFromHref, noteBodyHtml } from '../src/lib/footnote'

it('recognizes only in-page footnote targets', () => {
  expect(refIdFromHref('#ref-3')).toBe('ref-3')
  expect(refIdFromHref('#cite-1')).toBeNull()
  expect(refIdFromHref('#s-2')).toBeNull()
  expect(refIdFromHref('https://example.com/#ref-1')).toBeNull()
})
it('drops the back link and keeps source links', () => {
  const li = 'Patrick Boyle. 영상. <a href="https://www.youtube.com/watch?v=x">링크</a> <a class="back" href="#cite-1">↩</a>'
  expect(noteBodyHtml(li)).toBe('Patrick Boyle. 영상. <a href="https://www.youtube.com/watch?v=x">링크</a>')
})

import { noteTransition, type NoteState } from '../src/lib/footnote'
const closed: NoteState = { open: false, by: null, focus: false }
it('keeps a hover-opened note open when the mouse then clicks it', () => {
  const hovered = noteTransition(closed, 'hover')
  expect(hovered).toEqual({ open: true, by: 'hover', focus: false })
  expect(noteTransition(hovered, 'click')).toEqual({ open: true, by: 'click', focus: false })
})
it('toggles a click-opened note and ignores mouse leave once pinned', () => {
  const clicked = noteTransition(closed, 'click')
  expect(noteTransition(clicked, 'leave').open).toBe(true)
  expect(noteTransition(clicked, 'click').open).toBe(false)
  expect(noteTransition(noteTransition(closed, 'hover'), 'leave').open).toBe(false)
})
it('moves focus into the note when opened from the keyboard', () => {
  expect(noteTransition(closed, 'key')).toEqual({ open: true, by: 'click', focus: true })
  expect(noteTransition(noteTransition(closed, 'key'), 'key').open).toBe(false)
})
