import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { communityApi } from '../../services/api'
import type { components } from '../../types/api'
import './app-pages.css'

type ShareItem = (components['schemas']['CommunityShareItem'] & { liked?: boolean })
type SearchResultItem = components['schemas']['SearchResultItem']

type BusyMap = Record<number, boolean>

export default function Community() {
    const [feed, setFeed] = useState<ShareItem[]>([])
    const [feedError, setFeedError] = useState<string | null>(null)
    const [loadingFeed, setLoadingFeed] = useState(true)
    const [likeBusy, setLikeBusy] = useState<BusyMap>({})

    const [query, setQuery] = useState('')
    const [tag, setTag] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [results, setResults] = useState<SearchResultItem[]>([])
    const [hasSearched, setHasSearched] = useState(false)

    useEffect(() => {
        refreshFeed()
    }, [])

    async function refreshFeed() {
        setLoadingFeed(true)
        setFeedError(null)
        try {
            const page = await communityApi.list(1, 20)
            const items = (page?.items || []).map(it => ({ ...it, liked: false }))
            setFeed(items)
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '加载失败'
            setFeedError(msg)
        } finally {
            setLoadingFeed(false)
        }
    }

    async function toggleLike(shareId?: number) {
        if (!shareId) return
        if (likeBusy[shareId]) return
        setLikeBusy(prev => ({ ...prev, [shareId]: true }))
        const target = feed.find(it => it.shareId === shareId)
        const liked = !!target?.liked
        try {
            if (liked) await communityApi.unlike(shareId)
            else await communityApi.like(shareId)
            setFeed(items => items.map(it => {
                if (it.shareId !== shareId) return it
                const likes = (it.likes ?? 0) + (liked ? -1 : 1)
                return { ...it, liked: !liked, likes: Math.max(0, likes) }
            }))
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '操作失败'
            window.alert(msg)
        } finally {
            setLikeBusy(prev => {
                const next = { ...prev }
                delete next[shareId]
                return next
            })
        }
    }

    async function report(shareId?: number) {
        if (!shareId) return
        const reason = window.prompt('请输入举报理由（可简述违规点）')
        if (!reason || !reason.trim()) return
        try {
            await communityApi.report({ targetType: 'share', targetId: shareId, reason: reason.trim() })
            window.alert('已提交举报，我们会尽快处理')
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '举报失败'
            window.alert(msg)
        }
    }

    async function onSearch(e?: FormEvent) {
        e?.preventDefault()
        setSearching(true)
        setSearchError(null)
        setHasSearched(true)
        try {
            const res = await communityApi.search({
                q: query.trim() || undefined,
                tag: tag.trim() || undefined,
                page: 1,
                pageSize: 10,
            })
            setResults(res.items || [])
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '搜索失败'
            setSearchError(msg)
        } finally {
            setSearching(false)
        }
    }

    return (
        <div className="col gap-12">
            <section className="paper-card card-pad">
                <div className="row-between align-center">
                    <div>
                        <h3 className="mt-0 mb-4">社区广场</h3>
                        <div className="muted text-14">浏览热门分享，参与互动或举报违规内容。</div>
                    </div>
                    <button className="btn-ghost" onClick={refreshFeed} disabled={loadingFeed}>刷新</button>
                </div>
                {feedError && <div className="error-text mt-8">{feedError}</div>}
                {loadingFeed ? (
                    <div className="muted mt-8">加载中...</div>
                ) : feed.length === 0 ? (
                    <div className="empty-box mt-8">暂无分享</div>
                ) : (
                    <div className="col gap-10 mt-8">
                        {feed.map(item => (
                            <div key={item.shareId} className="community-item">
                                <div className="col gap-4">
                                    <div className="fw-600 text-16">{item.title || '未命名对局'}</div>
                                    <div className="muted text-12">分享 ID：{item.shareId ?? '—'}</div>
                                </div>
                                <div className="row gap-8 align-center ml-auto">
                                    <button
                                        className={`pill-btn ${item.liked ? 'pill-btn--active' : ''}`}
                                        onClick={() => toggleLike(item.shareId)}
                                        disabled={likeBusy[item.shareId ?? -1]}
                                    >
                                        <span role="img" aria-label="like">👍</span>
                                        <span className="ml-4">{item.liked ? '已赞' : '点赞'}</span>
                                        <span className="like-chip">{item.likes ?? 0}</span>
                                    </button>
                                    <button className="link-btn" onClick={() => report(item.shareId)}>举报</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="paper-card card-pad">
                <h3 className="mt-0 mb-8">搜索对局</h3>
                <form className="community-search" onSubmit={onSearch}>
                    <input
                        className="community-input"
                        placeholder="关键词（标题/作者）"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <input
                        className="community-input"
                        placeholder="标签（可选）"
                        value={tag}
                        onChange={e => setTag(e.target.value)}
                    />
                    <button type="submit" className="btn-primary" disabled={searching}>
                        {searching ? '搜索中…' : '搜索'}
                    </button>
                </form>
                {searchError && <div className="error-text mt-8">{searchError}</div>}
                {results.length > 0 ? (
                    <div className="col gap-8 mt-12">
                        {results.map(item => (
                            <div key={item.recordId} className="community-result">
                                <div>
                                    <div className="fw-600">{item.title || '未命名对局'}</div>
                                    <div className="muted text-12">记录 ID：{item.recordId ?? '—'}</div>
                                </div>
                                {item.recordId != null && (
                                    <Link className="btn-ghost" to={`/app/record/${item.recordId}`}>
                                        查看
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                ) : hasSearched ? (
                    <div className="muted mt-8">未找到符合条件的对局</div>
                ) : (
                    <div className="muted mt-8">输入关键词或标签后搜索对局</div>
                )}
            </section>
        </div>
    )
}
