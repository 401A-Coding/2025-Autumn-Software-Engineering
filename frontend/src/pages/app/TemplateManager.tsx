import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { boardStore, type SavedBoard } from '../../features/boards/boardStore'

export default function TemplateManager() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<SavedBoard[]>([])

  const refresh = () => {
    try {
      setTemplates(boardStore.list())
    } catch (e) {
      console.error('failed to load templates', e)
      setTemplates([])
    }
  }

  useEffect(() => {
    refresh()
    const h = () => refresh()
    window.addEventListener('saved-boards-changed', h)
    return () => window.removeEventListener('saved-boards-changed', h)
  }, [])

  const handleApply = (id: string) => {
    const tpl = boardStore.get(id)
    if (!tpl) { alert('模板未找到'); return }
    if (tpl.board) localStorage.setItem('placementBoard', JSON.stringify(tpl.board))
    if (tpl.ruleSet) localStorage.setItem('customRuleSet', JSON.stringify(tpl.ruleSet))
    alert(`已应用模板：${tpl.name}（已保存至本地，前往编辑或开始对局）`)
    navigate('/app/visual-editor')
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定删除该模板？此操作无法撤销')) return
    boardStore.remove(id)
    refresh()
  }

  const handleRename = (id: string) => {
    const tpl = boardStore.get(id)
    if (!tpl) return
    const name = prompt('新的模板名称：', tpl.name)
    if (!name) return
    boardStore.update(id, { name })
    refresh()
  }

  const handleOverwrite = (id: string) => {
    if (!confirm('用当前编辑器中的布局与规则覆盖此模板？请先在可视化编辑器里准备好布局和规则，然后使用覆盖。')) return
    const placement = localStorage.getItem('placementBoard')
    const rules = localStorage.getItem('customRuleSet')
    boardStore.update(id, { board: placement ? JSON.parse(placement) : undefined, ruleSet: rules ? JSON.parse(rules) : undefined })
    refresh()
    alert('模板已覆盖')
  }

  return (
    <div className="pad-16 mw-960 mx-auto">
      <div className="row-between mb-12">
        <h2 className="fw-700">模板管理</h2>
        <div className="row gap-8">
          <button className="btn-lg btn-lg--slate" onClick={() => navigate('/app/visual-editor')}>返回编辑器</button>
        </div>
      </div>

      <div className="card-surface mb-12">
        <p className="text-13 text-gray">在此查看、应用、覆盖、重命名或删除已保存的模板。"应用"会把模板写入 localStorage（`placementBoard` / `customRuleSet`），然后返回可视化编辑器以便进一步调整或直接开始对局。</p>
      </div>

      {templates.length === 0 ? (
        <div className="text-13 text-gray">当前没有模板，先在可视化编辑器中保存一个模板。</div>
      ) : (
        <div className="grid-auto-250 gap-8">
          {templates.map(t => (
            <div key={t.id} className="pad-8 bg-white rounded-6">
              <div className="row-between align-center mb-6">
                <div className="fw-600 text-14">{t.name}</div>
                <div className="text-12 text-gray">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-13 text-slate mb-6">{t.description || ''}</div>
              <div className="row gap-8">
                <button className="btn-primary btn-compact" onClick={() => handleApply(t.id)}>应用</button>
                <button className="btn-compact" onClick={() => handleOverwrite(t.id)}>覆盖</button>
                <button className="btn-compact" onClick={() => handleRename(t.id)}>重命名</button>
                <button className="btn-danger btn-compact" onClick={() => handleDelete(t.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
