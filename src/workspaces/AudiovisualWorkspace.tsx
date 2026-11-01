import Editor from '@monaco-editor/react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import { StatusBarSlots } from '../chrome'
import { ExplorerIcon } from '../explorerIcons'
import {
  allocateNewFileBase,
  findNewFileType,
  newFileName,
  validateNewFileBase,
} from '../newFileTypes'
import { notify } from '../activity'
import { ServiceError } from '../collab/protocol'
import { FilePresenceBar } from '../project/FilePresenceBar'
import { setBoundProject } from '../project/bindingBus'
import { saveProjectToDirectory } from '../project/projectFs'
import {
  getProjectSession,
  setProjectSession,
  useProjectSession,
} from '../project/projectSession'
import { confirmDialog } from '../ui/dialogs'
import { EditorDock, resetEditorDock } from '../ui/EditorDock'
import { PanelDock, resetPanelDock, type DockPanelSpec } from '../ui/PanelDock'
import {
  createScript,
  saveWorkspace,
  sourcePathOf,
  type SourceFile,
  type Workspace,
} from '../workspace'
import { HANSHU_THEME_ID, registerHanshuLanguage } from '../monaco/hanshuLanguage'
import { useEditorFontSize } from './gameplay/editorFont'
import { AudiovisualExplorer } from './audiovisual/AudiovisualExplorer'
import { createBossbar, stringifyBossbar } from './audiovisual/bossbar'
import './AudiovisualWorkspace.css'

const DOCK_KEY = 'hanshu.audiovisualDock.v1'
const EDITOR_DOCK_KEY = 'hanshu.audiovisualEditorDock.v1'
const UI_KEY = 'hanshu.audiovisualUi.v1'
const BOSSBAR_EXT = '.bossbar'

type UiState = {
  openKeys: string[]
  activeKey: string | null
  pinnedKeys: string[]
}

function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return { openKeys: [], activeKey: null, pinnedKeys: [] }
    const parsed = JSON.parse(raw) as Partial<UiState>
    return {
      openKeys: Array.isArray(parsed.openKeys) ? parsed.openKeys.filter((item): item is string => typeof item === 'string') : [],
      activeKey: typeof parsed.activeKey === 'string' ? parsed.activeKey : null,
      pinnedKeys: Array.isArray(parsed.pinnedKeys) ? parsed.pinnedKeys.filter((item): item is string => typeof item === 'string') : [],
    }
  } catch {
    return { openKeys: [], activeKey: null, pinnedKeys: [] }
  }
}

function saveUi(state: UiState) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(state))
  } catch {
    /* 无痕模式只保留内存 */
  }
}

function isBossbar(file: SourceFile) {
  return file.name.toLowerCase().endsWith(BOSSBAR_EXT)
}

function withScripts(workspace: Workspace, scripts: SourceFile[]): Workspace {
  const pkg = workspace.packages[0]
  if (!pkg) return workspace
  return {
    ...workspace,
    packages: [{ ...pkg, scripts }],
  }
}

function replaceScript(workspace: Workspace, id: string, patch: Partial<SourceFile>): Workspace {
  const pkg = workspace.packages[0]
  if (!pkg) return workspace
  return withScripts(
    workspace,
    pkg.scripts.map((script) => (script.id === id ? { ...script, ...patch, updatedAt: Date.now() } : script)),
  )
}

export type AudiovisualWorkspaceHandle = {
  handleMenuAction: (item: string) => void
}

export function AudiovisualWorkspace({
  active,
  workspaceRef,
}: {
  active: boolean
  workspaceRef?: Ref<AudiovisualWorkspaceHandle>
}) {
  const session = useProjectSession()
  const client = session.binding?.handle.client
  const projectBound = Boolean(session.binding)
  const readOnly = !client?.writable
  const editorFontSize = useEditorFontSize()
  const [ui, setUi] = useState(loadUi)
  const [busy, setBusy] = useState(false)
  const structuralPendingRef = useRef(false)

  const files = useMemo(
    () => (session.workspace.packages[0]?.scripts ?? []).filter(isBossbar),
    [session.workspace],
  )
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])

  useEffect(() => {
    const known = new Set(files.map((file) => file.id))
    setUi((previous) => {
      const openKeys = previous.openKeys.filter((key) => known.has(key))
      const pinnedKeys = previous.pinnedKeys.filter((key) => openKeys.includes(key))
      const activeKey =
        previous.activeKey && openKeys.includes(previous.activeKey)
          ? previous.activeKey
          : (openKeys[0] ?? null)
      const next = { openKeys, activeKey, pinnedKeys }
      if (
        next.openKeys.join('\0') === previous.openKeys.join('\0') &&
        next.activeKey === previous.activeKey &&
        next.pinnedKeys.join('\0') === previous.pinnedKeys.join('\0')
      ) {
        return previous
      }
      saveUi(next)
      return next
    })
  }, [files])

  const updateUi = useCallback((change: UiState | ((previous: UiState) => UiState)) => {
    setUi((previous) => {
      const next = typeof change === 'function' ? change(previous) : change
      saveUi(next)
      return next
    })
  }, [])

  const openFile = useCallback(
    (id: string) => {
      updateUi((previous) => ({
        ...previous,
        openKeys: previous.openKeys.includes(id) ? previous.openKeys : [...previous.openKeys, id],
        activeKey: id,
      }))
    },
    [updateUi],
  )

  const closePages = useCallback(
    (ids: string[], nextActiveId?: string) => {
      const closing = new Set(ids)
      updateUi((previous) => {
        const openKeys = previous.openKeys.filter((key) => !closing.has(key))
        const pinnedKeys = previous.pinnedKeys.filter((key) => openKeys.includes(key))
        const activeKey =
          nextActiveId && openKeys.includes(nextActiveId)
            ? nextActiveId
            : previous.activeKey && openKeys.includes(previous.activeKey)
              ? previous.activeKey
              : (openKeys[0] ?? null)
        return { openKeys, activeKey, pinnedKeys }
      })
    },
    [updateUi],
  )

  const changeSource = useCallback(
    (id: string, content: string) => {
      if (readOnly || structuralPendingRef.current) return
      const live = getProjectSession()
      const current = live.workspace.packages[0]?.scripts.find((script) => script.id === id)
      if (!current || current.content === content) return
      setProjectSession({ workspace: replaceScript(live.workspace, id, { content }) })
    },
    [readOnly],
  )

  const createBossbarFile = useCallback(() => {
    if (readOnly) return
    const type = findNewFileType('bossbar')
    if (!type) return
    const live = getProjectSession()
    const pkg = live.workspace.packages[0]
    if (!pkg) {
      notify('请先打开工程', { kind: 'error' })
      return
    }
    const occupied = (base: string) =>
      pkg.scripts.some(
        (script) => script.name.toLowerCase() === newFileName(type, base).toLowerCase(),
      )
    const base = allocateNewFileBase(type, occupied)
    const error = validateNewFileBase(type, base)
    if (error) {
      notify(error, { kind: 'error' })
      return
    }
    const name = newFileName(type, base)
    const script = createScript(name, stringifyBossbar(createBossbar(base)))
    setProjectSession({
      workspace: {
        ...withScripts(live.workspace, [...pkg.scripts, script]),
        activeScriptId: script.id,
      },
    })
    openFile(script.id)
  }, [openFile, readOnly])

  const renameFile = useCallback(
    (id: string, base: string): string | null => {
      if (readOnly) return '只读工程'
      const type = findNewFileType('bossbar')
      if (!type) return '缺少类型注册'
      const baseError = validateNewFileBase(type, base)
      if (baseError) return baseError
      const live = getProjectSession()
      const binding = live.binding
      const pkg = live.workspace.packages[0]
      const current = pkg?.scripts.find((script) => script.id === id)
      if (!pkg || !current) return '文件不存在'
      const nextName = newFileName(type, base)
      if (nextName.toLowerCase() === current.name.toLowerCase()) return null
      if (
        pkg.scripts.some(
          (script) =>
            script.id !== id && script.name.toLowerCase() === nextName.toLowerCase(),
        )
      ) {
        return `「${nextName}」已经存在`
      }
      const onServer = Boolean(binding?.handle.client.entry(sourcePathOf(current)))
      if (!onServer || !binding) {
        setProjectSession({ workspace: replaceScript(live.workspace, id, { name: nextName }) })
        return null
      }
      structuralPendingRef.current = true
      setBusy(true)
      void binding.handle.client
        .sourceCommands([
          {
            path: sourcePathOf(current),
            destination: sourcePathOf({ name: nextName }),
            content: current.content,
          },
        ])
        .then(() => {
          if (getProjectSession().binding?.handle.client !== binding.handle.client) return
          setProjectSession({
            workspace: replaceScript(getProjectSession().workspace, id, { name: nextName }),
          })
        })
        .catch((error) => {
          notify(
            error instanceof ServiceError && error.code === 'commit_uncertain'
              ? '改名结果待确认'
              : '改名未提交',
            { kind: 'error', detail: String(error) },
          )
        })
        .finally(() => {
          structuralPendingRef.current = false
          setBusy(false)
        })
      return null
    },
    [readOnly],
  )

  const deleteFile = useCallback(
    (id: string) => {
      if (readOnly) return
      const live = getProjectSession()
      const binding = live.binding
      const current = live.workspace.packages[0]?.scripts.find((script) => script.id === id)
      if (!current) return
      void confirmDialog({
        title: '删除 BOSS 血条',
        message: `删除「${current.name}」？此操作提交后不可从本窗口撤销。`,
        confirmLabel: '删除',
        danger: true,
      }).then((ok) => {
        if (!ok) return
        const onServer = Boolean(binding?.handle.client.entry(sourcePathOf(current)))
        const removeLocal = () => {
          const latest = getProjectSession()
          const pkg = latest.workspace.packages[0]
          if (!pkg) return
          setProjectSession({
            workspace: withScripts(
              latest.workspace,
              pkg.scripts.filter((script) => script.id !== id),
            ),
          })
          closePages([id])
        }
        if (!onServer || !binding) {
          removeLocal()
          return
        }
        structuralPendingRef.current = true
        setBusy(true)
        void binding.handle.client
          .sourceCommands([{ path: sourcePathOf(current), destination: null }])
          .then(() => {
            if (getProjectSession().binding?.handle.client !== binding.handle.client) return
            removeLocal()
          })
          .catch((error) => {
            notify(
              error instanceof ServiceError && error.code === 'commit_uncertain'
                ? '删除结果待确认'
                : '删除未提交',
              { kind: 'error', detail: String(error) },
            )
          })
          .finally(() => {
            structuralPendingRef.current = false
            setBusy(false)
          })
      })
    },
    [closePages, readOnly],
  )

  const saveDraft = useCallback(async () => {
    const live = getProjectSession()
    if (!live.binding) {
      notify('请先打开工程', { kind: 'error' })
      return
    }
    setBusy(true)
    const saveClient = live.binding.handle.client
    try {
      saveWorkspace(live.workspace)
      const saved = await saveProjectToDirectory(live.binding, live.workspace)
      setProjectSession({ binding: saved })
      setBoundProject(saved)
      notify('已保存到工程', { kind: 'success' })
    } catch (error) {
      notify('保存失败', {
        kind: 'error',
        detail: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (getProjectSession().binding?.handle.client === saveClient) setBusy(false)
    }
  }, [])

  useImperativeHandle(
    workspaceRef,
    () => ({
      handleMenuAction(item) {
        if (item === 'save') {
          void saveDraft()
          return
        }
        if (item === 'editor-layout') {
          void confirmDialog({
            title: '编辑器布局',
            message: '恢复默认停靠布局？当前拖过的栏目位置会丢掉。',
            confirmLabel: '恢复',
          }).then((ok) => {
            if (ok) {
              resetPanelDock(DOCK_KEY)
              resetEditorDock(EDITOR_DOCK_KEY)
            }
          })
        }
      },
    }),
    [saveDraft],
  )

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, saveDraft])

  const activeFile = ui.activeKey ? fileById.get(ui.activeKey) ?? null : null
  const presencePath =
    active && client && activeFile && !activeFile.detached ? sourcePathOf(activeFile) : null

  const dockPanels: DockPanelSpec[] = [
    {
      id: 'explorer',
      title: '资源管理器',
      defaultPlacement: 'left',
      defaultSize: 280,
      minSize: 180,
      render: (dock) => (
        <AudiovisualExplorer
          files={files}
          activeId={ui.activeKey}
          readOnly={readOnly || !projectBound}
          onOpen={openFile}
          onCreate={createBossbarFile}
          onRename={renameFile}
          onDelete={deleteFile}
          placement={dock.placement}
          onTitlePointerDown={dock.onTitlePointerDown}
          onRedock={dock.onRedock}
        />
      ),
    },
  ]

  const editorPages = ui.openKeys.flatMap((id) => {
    const file = fileById.get(id)
    if (!file) return []
    return [
      {
        id: file.id,
        title: file.name,
        tooltip: sourcePathOf(file),
        icon: (
          <span className="editor-dock-file-icon">
            <ExplorerIcon kind="bossbar" />
          </span>
        ),
      },
    ]
  })

  return (
    <section className="audiovisual-workspace" aria-label="视听效果工作区">
      <PanelDock storageKey={DOCK_KEY} panels={dockPanels}>
        <main className="av-main">
          {presencePath && (
            <FilePresenceBar
              key={`${client!.snapshot.session.id}:${presencePath}`}
              client={client!}
              path={presencePath}
              mode="optimistic"
              label={activeFile?.name}
            />
          )}
          {editorPages.length ? (
            <EditorDock
              storageKey={EDITOR_DOCK_KEY}
              pages={editorPages}
              activeId={ui.activeKey}
              onActivate={(id) => openFile(id)}
              onClose={(id) => closePages([id])}
              onCloseMany={closePages}
              enableTabMenu
              initialPinnedIds={ui.pinnedKeys}
              onPinnedChange={(ids) =>
                updateUi((previous) => ({
                  ...previous,
                  pinnedKeys: ids.filter((id) => previous.openKeys.includes(id)),
                }))
              }
              renderPage={(id) => {
                const file = fileById.get(id)
                if (!file) return null
                return (
                  <div
                    className="av-editor-pane"
                    onPointerDownCapture={() => {
                      if (file.id !== ui.activeKey) openFile(file.id)
                    }}
                  >
                    {file.detached && (
                      <p className="av-banner" role="status">
                        资源已从工程移除，草稿仅保留在本机；普通保存不会重新创建它。
                      </p>
                    )}
                    <div className="av-json-editor" aria-label=".bossbar JSON">
                      <Editor
                        height="100%"
                        language="json"
                        theme={HANSHU_THEME_ID}
                        value={file.content}
                        path={`audiovisual-bossbar://${file.id}/${file.name}`}
                        beforeMount={registerHanshuLanguage}
                        onChange={(value) => {
                          if (!readOnly && !file.detached) changeSource(file.id, value ?? '')
                        }}
                        options={{
                          fontSize: editorFontSize,
                          mouseWheelZoom: true,
                          minimap: { enabled: false },
                          wordWrap: 'on',
                          automaticLayout: true,
                          scrollBeyondLastLine: false,
                          padding: { top: 8 },
                          readOnly: readOnly || Boolean(file.detached),
                          domReadOnly: readOnly || Boolean(file.detached),
                        }}
                      />
                    </div>
                  </div>
                )
              }}
            />
          ) : (
            <div className="av-empty">
              <span className="av-empty-icon">▣</span>
              <h2>视听效果</h2>
              <p>
                左侧「BOSS血条」分类可新建 <code>.bossbar</code>
                。当前用 JSON 源码编辑；可视化编辑器稍后接入。
              </p>
            </div>
          )}
        </main>
      </PanelDock>
      <StatusBarSlots
        active={active}
        left={
          <span>
            {!projectBound
              ? '需要工程目录'
              : busy
                ? '正在保存…'
                : readOnly
                  ? '只读'
                  : 'Ctrl+S 保存到工程目录'}
          </span>
        }
        right={<span>视听效果 · BOSS血条</span>}
      />
    </section>
  )
}
