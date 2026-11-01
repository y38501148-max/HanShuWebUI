import type { MenuContribution, MenuCommand } from './types'

const always = () => true

function cmd(id: string, label: string): MenuCommand {
  return { id, label, run: 'workspace', enabled: always }
}

/** 视听效果工作区菜单贡献 */
export const audiovisualMenuContribution: MenuContribution = {
  menus: [
    {
      id: 'file',
      label: '文件',
      items: [cmd('save', '保存')],
    },
    {
      id: 'view',
      label: '查看',
      items: [cmd('editor-layout', '编辑器布局')],
    },
  ],
}
