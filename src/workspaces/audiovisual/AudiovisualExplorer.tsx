import { useState, type KeyboardEvent } from 'react'
import { ExplorerIcon } from '../../explorerIcons'
import { AUDIOVISUAL_CATEGORIES } from '../../resourceTypes'
import type { SourceFile } from '../../workspace'
import { resourceBaseError } from '../../resourceNames'

export function AudiovisualExplorer({
  files,
  activeId,
  readOnly,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: {
  files: readonly SourceFile[]
  activeId: string | null
  readOnly: boolean
  onOpen: (id: string) => void
  onCreate: () => void
  onRename: (id: string, base: string) => string | null
  onDelete: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
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
    <div className="av-explorer" aria-label="视听效果资源">
      <div className="av-explorer-head">
        <span className="av-explorer-category">
          <ExplorerIcon kind="bossbar" />
          {AUDIOVISUAL_CATEGORIES.bossbar.name}
        </span>
        <button type="button" className="av-explorer-add" disabled={readOnly} onClick={onCreate} title="新建 BOSS 血条">
          ＋
        </button>
      </div>
      <ul className="av-explorer-list" role="tree">
        {sorted.length === 0 && (
          <li className="av-explorer-empty">暂无 .bossbar。点 ＋ 新建，或用 JSON 源码编辑。</li>
        )}
        {sorted.map((file) => {
          const editing = editingId === file.id
          return (
            <li key={file.id} className={`av-explorer-row${activeId === file.id ? ' is-active' : ''}${file.detached ? ' is-detached' : ''}`} role="treeitem">
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
              {editing && editError && <p className="av-explorer-error" role="alert">{editError}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
