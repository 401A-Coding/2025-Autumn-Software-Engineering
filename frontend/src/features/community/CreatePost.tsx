import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import { communityApi } from '../../services/api'
import TagInput from '../../components/TagInput'

export default function CreatePost() {
    const navigate = useNavigate()
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [tags, setTags] = useState<string[]>([])
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
                <h2 className="mt-0 mb-16">发布新帖</h2>

                {error && <div className="alert alert-error mb-12">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* 标题输入 */}
                    <div className="form-group mb-16">
                        <label htmlFor="title" className="mb-6 d-block fw-600">
                            标题 *
                        </label>
                        <input
                            id="title"
                            type="text"
                            placeholder="请输入帖子标题"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            className="w-100"
                        />
                        <div className="text-12 muted mt-4">{title.length} / 200</div>
                    </div>

                    {/* 内容编辑 */}
                    <div className="form-group mb-16">
                        <label htmlFor="content" className="mb-6 d-block fw-600">
                            内容 *
                        </label>
                        <textarea
                            id="content"
                            placeholder="请输入帖子内容（支持换行）"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            maxLength={5000}
                            rows={12}
                            className="w-100"
                        />
                        <div className="text-12 muted mt-4">{content.length} / 5000</div>
                    </div>

                    {/* 标签输入 */}
                    <div className="form-group mb-16">
                        <label htmlFor="tags" className="mb-6 d-block fw-600">
                            标签（可选）
                        </label>
                        <TagInput
                            tags={tags}
                            onChange={setTags}
                            maxTags={5}
                            placeholder="输入标签名称"
                        />
                    </div>

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
