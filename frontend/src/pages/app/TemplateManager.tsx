import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiBoardToLocalFormat } from '../../features/chess/boardAdapter'
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
      setTemplates(items as any[])
    } catch (e) {
      console.error('failed to load templates from server', e)
      setTemplates([])
    }
  }

  useEffect(() => {
    void refresh()
    void refreshRemote()
    // remove local saved-boards listener because we no longer use local storage
    return () => { }
  }, [])

  const [remoteTemplates, setRemoteTemplates] = useState<any[]>([])

  const refreshRemote = async () => {
    try {
      const items = await boardApi.getTemplates()
      setRemoteTemplates(items)
    } catch (e) {
      // silent - user may not be logged in or server unavailable
      console.warn('failed to load remote templates', e)
      setRemoteTemplates([])
    }
  }

  const handleApply = (boardData: any) => {
    // 将服务器上的布局与规则通过路由 state 传递给可视化编辑器（可在编辑器中直接加载）
    const local = apiBoardToLocalFormat(boardData)
    navigate('/app/visual-editor', { state: { layout: local, rules: boardData.rules } })
  }

  const handlePlayLocally = (boardData: any) => {
    // 直接打开本地对局模式，导入模板的布局和规则
    const local = apiBoardToLocalFormat(boardData)
    navigate('/app/custom-battle', { state: { layout: local, rules: boardData.rules } })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该模板？此操作无法撤销')) return
    try {
      await boardApi.delete(id)
      alert('已删除')
      void refresh()
      void refreshRemote()
    } catch (e: any) {
      console.error('delete failed', e)
      alert(`删除失败：${e?.message || e}`)
    }
  }



  const handleImportRemote = async (boardId?: number) => {
    if (!boardId) return
    try {
      const data = await boardApi.get(boardId)
      const local = apiBoardToLocalFormat(data)
      // 直接打开编辑器并将布局与规则作为路由 state 传递（不在前端持久化）
      navigate('/app/visual-editor', { state: { layout: local, rules: data.rules } })
    } catch (e: any) {
      console.error('import failed', e)
      alert(`导入失败：${e?.message || e}`)
    }
  }

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
          <p className="text-13 text-gray">在此查看、应用、重命名或删除服务器上的模板。应用会把模板加载到可视化编辑器（不在前端本地持久化）。</p>
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
                  <button className="btn-primary btn-compact" onClick={() => handleApply(t)}>编辑</button>
                  <button className="btn-compact" onClick={() => handlePlayLocally(t)}>本地对局</button>
                  <button className="btn-compact" onClick={() => handleRename(t.id)}>重命名</button>
                  <button className="btn-danger btn-compact" onClick={() => handleDelete(t.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-20">
          <div className="row-between mb-8">
            <h3 className="fw-600">服务器模板</h3>
            <div className="row gap-8">
              <button className="btn-compact" onClick={() => refreshRemote()}>刷新</button>
            </div>
          </div>
          {remoteTemplates.length === 0 ? (
            <div className="text-13 text-gray">未检索到服务器模板（可能需要登录或服务器无模板）。</div>
          ) : (
            <div className="grid-auto-250 gap-8">
              {remoteTemplates.map((rt: any) => (
                <div key={rt.id} className="pad-8 bg-white rounded-6">
                  <div className="row-between align-center mb-6">
                    <div className="fw-600 text-14">{rt.name}</div>
                    <div className="text-12 text-gray">ID: {rt.id}</div>
                  </div>
                  <div className="text-13 text-slate mb-6">{rt.preview || ''}</div>
                  <div className="row gap-8">
                    <button className="btn-primary btn-compact" onClick={() => handleImportRemote(rt.id)}>编辑</button>
                    <button className="btn-compact" onClick={async () => { try { const data = await boardApi.get(rt.id); handlePlayLocally(data); } catch (e) { alert('导入失败'); } }}>本地对局</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileFrame>
  )
}
