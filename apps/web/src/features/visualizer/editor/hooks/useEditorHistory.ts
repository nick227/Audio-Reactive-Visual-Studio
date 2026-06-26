import { useCallback, useState } from 'react'
import type { Project } from '../../project/types'
import { loadActiveProject } from '../../project/projectLibrary'
import {
  commitHistory,
  patchHistoryPresent,
  redoHistory,
  resetHistory as createHistoryState,
  undoHistory,
  type HistoryState,
} from '../core/history'

export function useEditorHistory() {
  const [history, setHistory] = useState<HistoryState>(() => createHistoryState(loadActiveProject()))

  const patchPresent = useCallback((recipe: (current: Project) => Project) => {
    setHistory((current) => patchHistoryPresent(current, recipe))
  }, [])

  const commitProject = useCallback((recipe: (current: Project) => Project) => {
    setHistory((current) => commitHistory(current, recipe))
  }, [])

  const undo = useCallback(() => {
    setHistory(undoHistory)
  }, [])

  const redo = useCallback(() => {
    setHistory(redoHistory)
  }, [])

  const resetHistory = useCallback((present: Project) => {
    setHistory(createHistoryState(present))
  }, [])

  return {
    present: history.present,
    patchPresent,
    commitProject,
    undo,
    redo,
    resetHistory,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
