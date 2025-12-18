import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import { communityApi, recordsApi } from '../../services/api'
import TagInput from '../../components/TagInput'
import ResourceSelector from '../../components/ResourceSelector'
import BoardEmbed from '../../components/BoardEmbed'
import RecordEmbed from '../../components/RecordEmbed'

export default function CreatePost() {
    const navigate = useNavigate()
    const { postId } = useParams<{ postId: string }>()
    const isEditMode = !!postId

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const [resource, setResource] = useState<{
        shareType: 'NONE' | 'RECORD' | 'BOARD'
        shareRefId: number | null
    }>({
        shareType: 'NONE',
        shareRefId: null,
    })
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(isEditMode)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isEditMode && postId) {
            loadPost()
        }
    }, [postId, isEditMode])

    async function loadPost() {
        if (!postId) return
        setLoading(true)
        try {
            const data = await communityApi.getPost(Number(postId))
            setTitle(data.title || '')
            setContent(data.content || '')
            setTags(data.tags || [])

            if (data.shareReference?.refType && data.shareReference?.refId) {
                setResource({
                    shareType: data.shareReference.refType.toUpperCase() as 'RECORD' | 'BOARD',
                    shareRefId: data.shareReference.refId,
                })
            }
        } catch (e) {
            console.error('Failed to load post:', e)
            setError('加载帖子失败')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !content.trim()) {
            setError('标题和内容不能为空')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            // 后端期望 shareType 为小写（record/board），前端内部使用大写枚举
            const shareTypePayload =
                resource.shareType === 'RECORD' ? 'record'
                    : resource.shareType === 'BOARD' ? 'board'
                        : 'none'

            const basePayload = {
                title,
                content,
                tags: tags,
                shareType: shareTypePayload,
                shareRefId: resource.shareRefId,
            }

            // 若引用的是“对局记录”，在提交前尝试执行共享，确保他人可查看（由后端生成公共引用/快照）
            if (resource.shareType === 'RECORD' && resource.shareRefId) {
                try {
                    await recordsApi.share(resource.shareRefId, { title, tags })
                } catch (shareErr) {
                    // 共享失败不阻塞发帖，仅记录日志
                    console.warn('记录共享失败（仍尝试继续发帖）：', shareErr)
                }
            }

            if (isEditMode && postId) {
                await communityApi.updatePost(Number(postId), basePayload)
                alert('更新成功！')
                navigate(`/app/community/${postId}`)
            } else {
                await communityApi.createPost(basePayload)
                alert('发帖成功！')
                navigate('/app/community')
            }
        } catch (e: any) {
            console.error(isEditMode ? 'Update post failed:' : 'Create post failed:', e)
            setError(e.message || (isEditMode ? '更新失败' : '发帖失败'))
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="paper-card card-pad">
                <div className="muted text-center py-24">加载中...</div>
            </div>
        )
    }

    return (
        <div>
            {/* 返回按钮 */}
            <button className="btn-ghost mb-12" onClick={() => navigate(isEditMode ? `/app/community/${postId}` : '/app/community')}>
                ← 返回
            </button>

            {/* 发帖表单 */}
            <section className="paper-card card-pad">
                <h2 className="mt-0 mb-20">{isEditMode ? '编辑帖子' : '发布新帖'}</h2>

                {error && <div className="alert alert-error mb-16">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* 标题输入 - 隐式区域 */}
                    <div className="edit-area mb-16">
                        <input
                            id="title"
                            type="text"
                            placeholder="标题（必填）"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            className="edit-input edit-input--title"
                        />
                        <div className="text-12 muted mt-4">{title.length} / 200</div>
                    </div>

                    {/* 内容编辑 - 隐式区域 */}
                    <div className="edit-area mb-16">
                        <textarea
                            id="content"
                            placeholder="正文（必填，支持换行）"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            maxLength={5000}
                            rows={12}
                            className="edit-input edit-input--content"
                        />
                        <div className="text-12 muted mt-4">{content.length} / 5000</div>
                    </div>

                    {/* 标签输入 */}
                    <div className="edit-area mb-16">
                        <div className="text-14 fw-500 mb-8">标签（可选）</div>
                        <TagInput
                            tags={tags}
                            onChange={setTags}
                            maxTags={5}
                            placeholder="输入标签名称"
                        />
                    </div>

                    {/* 资源引用 */}
                    <div className="edit-area mb-16">
                        <ResourceSelector value={resource} onChange={setResource} />
                    </div>

                    {/* 引用预览 */}
                    {resource.shareType === 'RECORD' && resource.shareRefId && (
                        <div className="edit-area mb-16">
                            <RecordEmbed recordId={resource.shareRefId} enableSave={false} />
                        </div>
                    )}
                    {resource.shareType === 'BOARD' && resource.shareRefId && (
                        <div className="edit-area mb-16">
                            <BoardEmbed
                                boardId={resource.shareRefId}
                                enableSave={false}
                                titleOverride="帖子引用的残局"
                            />
                        </div>
                    )}

                    {/* 提交按钮 */}
                    <div className="row-end gap-8">
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => navigate(isEditMode ? `/app/community/${postId}` : '/app/community')}
                            disabled={submitting}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={submitting || !title.trim() || !content.trim()}
                        >
                            {submitting ? (isEditMode ? '保存中...' : '发布中...') : (isEditMode ? '保存' : '发布')}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
