import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import { communityApi } from '../../services/api'
import TagInput from '../../components/TagInput'
import ResourceSelector from '../../components/ResourceSelector'
import BoardPreview from '../../components/BoardPreview'
import RecordEmbed from '../../components/RecordEmbed'

export default function CreatePost() {
    const navigate = useNavigate()
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
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim() || !content.trim()) {
            setError('标题和内容不能为空')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            await communityApi.createPost({
                title,
                content,
                tags: tags,
                ...(resource.shareType !== 'NONE' && {
                    shareType: resource.shareType,
                    shareRefId: resource.shareRefId,
                }),
            })

            alert('发帖成功！')
            navigate('/app/community')
        } catch (e: any) {
            console.error('Create post failed:', e)
            setError(e.message || '发帖失败')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div>
            {/* 返回按钮 */}
            <button className="btn-ghost mb-12" onClick={() => navigate('/app/community')}>
                ← 返回
            </button>

            {/* 发帖表单 */}
            <section className="paper-card card-pad">
                <h2 className="mt-0 mb-20">发布新帖</h2>

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
                            <RecordEmbed recordId={resource.shareRefId} />
                        </div>
                    )}
                    {resource.shareType === 'BOARD' && resource.shareRefId && (
                        <div className="edit-area mb-16">
                            <BoardPreview
                                boardId={resource.shareRefId}
                                onClick={() => navigate(`/app/boards/${resource.shareRefId}`)}
                            />
                        </div>
                    )}

                    {/* 提交按钮 */}
                    <div className="row-end gap-8">
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => navigate('/app/community')}
                            disabled={submitting}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={submitting || !title.trim() || !content.trim()}
                        >
                            {submitting ? '发布中...' : '发布'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
