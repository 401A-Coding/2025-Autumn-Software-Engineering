import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { boardApi } from '../../services/api'
import { serverRulesToRuleSet } from '../../features/chess/ruleAdapter'
// no-op type import removed to avoid unused warnings
import './app-pages.css'

export default function CustomOnlineLobby() {
    const navigate = useNavigate()
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [action, setAction] = useState<'select' | 'create' | 'join'>('select')
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)
    const [joinRoomId, setJoinRoomId] = useState<string>('')

    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const mine = await boardApi.getMine(1, 50)
                const items = Array.isArray((mine as any)?.items)
                    ? (mine as any).items
                    : (Array.isArray(mine) ? (mine as any) : [])
                // 过滤出有有效规则的模板
                const validTemplates = (items as any[]).filter((t: any) => 
                    t?.rules && typeof t.rules === 'object' && t.rules.pieceRules
                )
                setTemplates(validTemplates as any[])
            } catch (e) {
                console.error('Failed to load templates', e)
                setTemplates([])
            } finally {
                setLoading(false)
            }
        }
        loadTemplates()
    }, [])

    const handleCreateRoom = (template: any) => {
        setSelectedTemplate(template)
        setAction('create')
    }

    const handleConfirmCreate = async () => {
        if (!selectedTemplate) return
        // 为确保携带完整规则，先按 ID 拉取详情（列表可能无 rules）
        let rulesDto = selectedTemplate.rules
        let layout = selectedTemplate.layout
        try {
            const full = await boardApi.get(Number(selectedTemplate.id))
            rulesDto = full?.rules ?? rulesDto
            layout = full?.layout ?? layout
        } catch {
            // 忽略，沿用列表中的最小信息
        }
        // 统一转换为 CustomRuleSet，避免目标页误判并回落到标准规则
        navigate('/app/custom-online-live-battle?action=create', {
            state: {
                boardId: selectedTemplate.id,
                rules: rulesDto ? serverRulesToRuleSet(rulesDto) : undefined,
                layout,
            }
        })
    }

    const handleJoinRoom = () => {
        if (!joinRoomId.trim()) {
            alert('请输入房间号')
            return
        }
        const roomId = Number(joinRoomId)
        if (isNaN(roomId)) {
            alert('房间号必须是数字')
            return
        }
        navigate(`/app/custom-online-live-battle?action=join&room=${roomId}`)
    }

    if (loading) {
        return (
            <section className="paper-card card-pad text-center">
                <p>加载中...</p>
            </section>
        )
    }

    if (action === 'select') {
        return (
            <section className="paper-card card-pad">
                <div style={{ position: 'relative', paddingBottom: 8 }}>
                    <button className="btn-ghost" onClick={() => navigate('/app')} style={{ position: 'absolute', left: 0, top: 0 }}>
                        返回
                    </button>
                    <h2 className="mt-0" style={{ margin: 0 }}>自定义在线对战</h2>
                </div>
                <div className="muted text-14 mb-12">选择自定义棋局模板创建房间或加入房间进行对战</div>

                <div className="mb-16">
                    <h3 className="fw-600 mb-8">选择模板创建房间</h3>
                    {templates.length === 0 ? (
                        <div className="text-13 text-gray mb-12">
                            暂无模板。请先在
                            <button className="btn-link" onClick={() => navigate('/app/visual-editor')}>
                                可视化编辑器
                            </button>
                            中创建并保存模板。
                        </div>
                    ) : (
                        <div
                            className="col gap-8 mb-12"
                            style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}
                        >
                            {templates.map(t => (
                                <div key={t.id} className="pad-8 bg-white rounded-6 border-1 border-gray">
                                    <div className="fw-600 text-14 mb-4">{t.name}</div>
                                    <div className="text-12 text-gray mb-8">{t.description || '无描述'}</div>
                                    <button
                                        className="btn-primary btn-compact w-100"
                                        onClick={() => handleCreateRoom(t)}
                                    >
                                        创建房间
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="divider-h my-16" />

                <div>
                    <h3 className="fw-600 mb-8">加入房间</h3>
                    <div className="row gap-8">
                        <input
                            type="number"
                            placeholder="输入房间号"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value)}
                            className="input flex-1"
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                        />
                        <button className="btn-primary" onClick={handleJoinRoom}>
                            加入
                        </button>
                    </div>
                </div>
            </section>
        )
    }

    if (action === 'create') {
        return (
            <section className="paper-card card-pad">
                <div style={{ position: 'relative', paddingBottom: 8 }}>
                    <button className="btn-ghost" onClick={() => setAction('select')} style={{ position: 'absolute', left: 0, top: 0 }}>
                        返回
                    </button>
                    <h2 className="mt-0" style={{ margin: 0 }}>创建房间</h2>
                </div>
                <div className="col gap-12">
                    <div>
                        <p className="text-14">选中的模板: <strong>{selectedTemplate?.name}</strong></p>
                        <p className="text-13 text-gray">{selectedTemplate?.description}</p>
                    </div>
                    <div className="row gap-8">
                        <button className="btn-ghost" onClick={() => setAction('select')}>取消</button>
                        <button className="btn-primary" onClick={handleConfirmCreate}>
                            创建房间
                        </button>
                    </div>
                </div>
            </section>
        )
    }

    return null
}
