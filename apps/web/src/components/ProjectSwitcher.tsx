import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { ProjectIndexEntry } from '../features/visualizer/project/projectLibrary'

type Props = {
  projectName: string
  projects: ProjectIndexEntry[]
  activeProjectId: string
  onRename: (name: string) => void
  onSwitch: (id: string) => void
  onCreate: () => void
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
}: Props) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
    const trimmed = draftName.trim()
    if (!trimmed) {
      setDraftName(projectName)
      return
    }
    if (trimmed !== projectName) onRename(trimmed)
  }

  return (
    <div className="project-switcher" ref={rootRef}>
      <input
        className="project-switcher-title"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
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
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`project-switcher-item${item.id === activeProjectId ? ' is-active' : ''}`}
              onClick={() => {
                setOpen(false)
                onSwitch(item.id)
              }}
            >
              <span className="project-switcher-item-name">{item.name}</span>
              <span className="project-switcher-item-meta">{formatWhen(item.updatedAt)}</span>
            </button>
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
