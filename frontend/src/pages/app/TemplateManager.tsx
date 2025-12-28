import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiBoardToLocalFormat } from '../../features/chess/boardAdapter'
import { serverRulesToRuleSet } from '../../features/chess/ruleAdapter'
import { boardApi } from '../../services/api'
import MobileFrame from '../../components/MobileFrame'

export default function TemplateManager() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<any[]>([])

  const refresh = async () => {
    try {
      // 获取当前用户的自定义棋局（我的棋盘）优先
      const mine = await boardApi.getMine(1, 50)
      const items = (mine && (mine.items || mine)) || []
      // 最多显示 50 个模板
      const limited = Array.isArray(items) ? (items as any[]).slice(0, 50) : []
      setTemplates(limited as any[])
    } catch (e) {
      console.error('failed to load templates from server', e)
      setTemplates([])
    }
  }

  useEffect(() => {
    void refresh()
    // remove local saved-boards listener because we no longer use local storage
    return () => { }
  }, [])

  const handleApply = async (boardData: any) => {
    // 确保拿到完整规则：列表接口可能不返回 rules，需要按 ID 拉取详情
    let full = boardData
    try {
      if (boardData?.id) full = await boardApi.get(Number(boardData.id))
    } catch {
      // 保底使用传入数据
    }
    const local = apiBoardToLocalFormat(full)
    const ruleSet = full?.rules ? serverRulesToRuleSet(full.rules) : undefined
    navigate('/app/visual-editor', { state: { layout: local, rules: ruleSet } })
  }

  const handlePlayLocally = async (boardData: any) => {
    // 直接打开本地对局模式，导入模板的布局和规则（规则需要转换为 CustomRuleSet）
    let full = boardData
    try {
      if (boardData?.id) full = await boardApi.get(Number(boardData.id))
    } catch {
      // 保底使用传入数据
    }
    const local = apiBoardToLocalFormat(full)
    const ruleSet = full?.rules ? serverRulesToRuleSet(full.rules) : undefined
    navigate('/app/custom-battle', { state: { layout: local, rules: ruleSet } })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该模板？此操作无法撤销')) return
    try {
      await boardApi.delete(id)
      alert('已删除')
      void refresh()
    } catch (e: any) {
      console.error('delete failed', e)
      alert(`删除失败：${e?.message || e}`)
    }
  }



  // 已移除服务器模板入口

  const handleRename = async (id: string) => {
    const current = templates.find(t => `${t.id}` === `${id}`)
    const name = prompt('新的模板名称：', current?.name || '')
    if (!name) return
    try {
      await boardApi.update(Number(id), { name })
      alert('已重命名')
      void refresh()
    } catch (e: any) {
      console.error('rename failed', e)
      alert(`重命名失败：${e?.message || e}`)
    }
  }


  return (
    <MobileFrame>
      <div className="pad-16 mw-960 mx-auto">
        <div className="row-between mb-12">
          <h2 className="fw-700">模板管理</h2>
          <div className="row gap-8">
            <button className="btn-lg btn-lg--slate" onClick={() => navigate('/app/visual-editor')}>返回编辑器</button>
          </div>
        </div>

        <div className="card-surface mb-12">
          <p className="text-13 text-gray">在此查看、应用、重命名或删除模板。应用会把模板加载到可视化编辑器（不在前端本地持久化）。</p>
        </div>

        {templates.length === 0 ? (
          <div className="text-13 text-gray">当前没有模板，先在可视化编辑器中保存一个模板。</div>
        ) : (
          // 滚轮式浏览：限定高度，纵向滚动，便于快速浏览最多 50 个模板
          <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8, border: '1px solid #eee', borderRadius: 8 }}>
            {templates.map(t => (
              <div key={t.id} className="pad-8 bg-white rounded-6" style={{ marginBottom: 8 }}>
                <div className="row-between align-center mb-6">
                  <div className="fw-600 text-14">{t.name}</div>
                  <div className="text-12 text-gray">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-13 text-slate mb-6">{t.description || ''}</div>
                <div className="row gap-8">
                  <button className="btn-primary btn-compact" onClick={() => handleApply(t)}>编辑</button>
                  <button className="btn-compact" onClick={() => handlePlayLocally(t)}>本地对局</button>
                  <button className="btn-compact" onClick={() => handleRename(t.id)}>重命名</button>
                  <button className="btn-danger btn-compact" onClick={() => handleDelete(t.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileFrame>
  )
}
