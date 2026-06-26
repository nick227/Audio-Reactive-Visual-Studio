import type { Project } from '../../project/types'
import { nowIso } from '../../entities/entityTypes'

export const MAX_HISTORY = 50

export type HistoryState = {
  past: Project[]
  present: Project
  future: Project[]
}

export function patchHistoryPresent(
  history: HistoryState,
  recipe: (current: Project) => Project,
): HistoryState {
  return {
    ...history,
    present: { ...recipe(history.present), updatedAt: nowIso() },
  }
}

export function commitHistory(
  history: HistoryState,
  recipe: (current: Project) => Project,
): HistoryState {
  const next = recipe(history.present)
  return {
    past: [...history.past.slice(-(MAX_HISTORY - 1)), history.present],
    present: { ...next, updatedAt: nowIso() },
    future: [],
  }
}

export function undoHistory(history: HistoryState): HistoryState {
  if (!history.past.length) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future.slice(0, MAX_HISTORY - 1)],
  }
}

export function redoHistory(history: HistoryState): HistoryState {
  if (!history.future.length) return history
  const next = history.future[0]
  return {
    past: [...history.past.slice(-(MAX_HISTORY - 1)), history.present],
    present: next,
    future: history.future.slice(1),
  }
}

export function resetHistory(present: Project): HistoryState {
  return { past: [], present, future: [] }
}
