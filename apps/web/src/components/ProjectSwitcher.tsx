import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, Plus, Trash2 } from 'lucide-react'
import type { ProjectIndexEntry } from '../features/visualizer/project/projectLibrary'

type Props = {
  projectName: string
  projects: ProjectIndexEntry[]
  activeProjectId: string
  onRename: (name: string) => void
  onSwitch: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ProjectSwitcher({
  projectName,
  projects,
  activeProjectId,
  onRename,
  onSwitch,
  onCreate,
  onDuplicate,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const rootRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = false
    setDraftName(projectName)
  }, [projectName, activeProjectId])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function commitName() {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    const trimmed = draftName.trim()
    if (!trimmed) {
      setDraftName(projectName)
      return
    }
    if (trimmed !== projectName.trim()) onRename(trimmed)
  }

  function confirmDelete(item: ProjectIndexEntry) {
    const ok = window.confirm(
      `Delete "${item.name}"?\n\nThis cannot be undone. Media only used by this project will be removed from local storage.`,
    )
    if (!ok) return
    setOpen(false)
    void onDelete(item.id)
  }

  return (
    <div className="project-switcher" ref={rootRef}>
      <input
        className="project-switcher-title"
        value={draftName}
        onChange={(e) => {
          dirtyRef.current = true
          setDraftName(e.target.value)
        }}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraftName(projectName)
            e.currentTarget.blur()
          }
        }}
        aria-label="Project title"
      />
      <button
        type="button"
        className="project-switcher-toggle"
        aria-label="Switch project"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="project-switcher-menu" role="menu">
          {projects.map((item) => (
            <div
              key={item.id}
              className={`project-switcher-row${item.id === activeProjectId ? ' is-active' : ''}`}
            >
              <button
                type="button"
                role="menuitem"
                className="project-switcher-item"
                onClick={() => {
                  setOpen(false)
                  onSwitch(item.id)
                }}
              >
                <span className="project-switcher-item-name">{item.name}</span>
                <span className="project-switcher-item-meta">{formatWhen(item.updatedAt)}</span>
              </button>
              <div className="project-switcher-actions">
                <button
                  type="button"
                  className="project-switcher-action"
                  aria-label={`Duplicate ${item.name}`}
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    onDuplicate(item.id)
                  }}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="project-switcher-action project-switcher-action--danger"
                  aria-label={`Delete ${item.name}`}
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDelete(item)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            role="menuitem"
            className="project-switcher-new"
            onClick={() => {
              setOpen(false)
              onCreate()
            }}
          >
            <Plus size={14} />
            New project
          </button>
        </div>
      )}
    </div>
  )
}
