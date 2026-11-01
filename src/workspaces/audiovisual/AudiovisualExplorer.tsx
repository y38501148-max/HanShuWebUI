import { useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ExplorerIcon } from '../../explorerIcons'
import { AUDIOVISUAL_CATEGORIES } from '../../resourceTypes'
import type { SourceFile } from '../../workspace'
import { resourceBaseError } from '../../resourceNames'
import type { DockPlacement } from '../../ui/panelDockModel'

export function AudiovisualExplorer({
  files,
  activeId,
  readOnly,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  placement = 'left',
  onTitlePointerDown,
  onRedock,
}: {
  files: readonly SourceFile[]
  activeId: string | null
  readOnly: boolean
  onOpen: (id: string) => void
  onCreate: () => void
  onRename: (id: string, base: string) => string | null
  onDelete: (id: string) => void
  placement?: DockPlacement
  onTitlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
  onRedock?: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(true)
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  const beginRename = (file: SourceFile) => {
    if (readOnly) return
    setEditingId(file.id)
    setEditValue(file.name.replace(/\.bossbar$/i, ''))
    setEditError('')
  }

  const commitRename = () => {
    if (!editingId) return
    const error = resourceBaseError(editValue) ?? onRename(editingId, editValue.trim())
    if (error) {
      setEditError(error)
      return
    }
    setEditingId(null)
    setEditError('')
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditingId(null)
      setEditError('')
    }
  }

  return (
    <aside className="av-library" aria-label="视听效果资源管理器">
      <div
        className={`av-explorer-heading${onTitlePointerDown ? ' is-draggable' : ''}`}
        onPointerDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('button, input, label, a, textarea, select')
          ) {
            return
          }
          onTitlePointerDown?.(event)
        }}
      >
        <strong
          title={
            onTitlePointerDown
              ? placement === 'float'
                ? '拖动标题可停靠到边缘；松手在中间则保持弹层'
                : '拖动标题可停靠到左、右、上、下，拖到中间变成弹层'
              : '资源管理器'
          }
        >
          资源管理器
        </strong>
        <div className="av-explorer-tools">
          {onRedock && (
            <button type="button" className="panel-dock-redock" title="停靠回上次的边缘" onClick={onRedock}>
              停靠
            </button>
          )}
          <button
            type="button"
            title="新建 BOSS 血条"
            aria-label="新建 BOSS 血条"
            disabled={readOnly}
            onClick={onCreate}
          >
            ＋
          </button>
        </div>
      </div>

      <div className="av-explorer-body">
        <button
          type="button"
          className="av-category-row"
          aria-expanded={categoryOpen}
          onClick={() => setCategoryOpen((open) => !open)}
        >
          <span className="av-twist" aria-hidden>
            {categoryOpen ? '▾' : '▸'}
          </span>
          <ExplorerIcon kind="bossbar" />
          <span className="av-category-name">{AUDIOVISUAL_CATEGORIES.bossbar.name}</span>
          <span className="av-category-count">{sorted.length}</span>
        </button>

        {categoryOpen && (
          <ul className="av-explorer-list" role="tree">
            {sorted.length === 0 && (
              <li className="av-explorer-empty">暂无 .bossbar。点标题栏 ＋ 新建。</li>
            )}
            {sorted.map((file) => {
              const editing = editingId === file.id
              return (
                <li
                  key={file.id}
                  className={`av-explorer-row${activeId === file.id ? ' is-active' : ''}${file.detached ? ' is-detached' : ''}`}
                  role="treeitem"
                >
                  <button
                    type="button"
                    className="av-explorer-item"
                    onClick={() => onOpen(file.id)}
                    onDoubleClick={() => beginRename(file)}
                  >
                    <ExplorerIcon kind="bossbar" />
                    {editing ? (
                      <input
                        className="av-explorer-rename"
                        value={editValue}
                        aria-label="重命名"
                        autoFocus
                        onChange={(event) => {
                          setEditValue(event.target.value)
                          setEditError('')
                        }}
                        onBlur={commitRename}
                        onKeyDown={onKey}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      <span className="av-explorer-name">{file.name}</span>
                    )}
                  </button>
                  {!readOnly && !editing && (
                    <button
                      type="button"
                      className="av-explorer-delete"
                      title="删除"
                      aria-label={`删除 ${file.name}`}
                      onClick={() => onDelete(file.id)}
                    >
                      ×
                    </button>
                  )}
                  {editing && editError && (
                    <p className="av-explorer-error" role="alert">
                      {editError}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
