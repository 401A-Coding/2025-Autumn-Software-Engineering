import React from 'react'
import '../../pages/app/community.css'
import UserAvatar from '../../components/UserAvatar'
import RecordEmbed from '../../components/RecordEmbed'
import BoardEmbed from '../../components/BoardEmbed'

type Props = {
    post: any
    onClick?: () => void
    actionsNode?: React.ReactNode
}

export default function PostPreview({ post, onClick, actionsNode }: Props) {
    return (
        <div
            className="paper-card cursor-pointer hover:shadow-md transition-shadow"
            style={{ padding: 0, overflow: 'hidden', backgroundColor: '#fff' }}
            onClick={onClick}
        >
            <div style={{ padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <UserAvatar
                    userId={post.authorId}
                    nickname={post.authorNickname}
                    avatarUrl={post.authorAvatar ?? undefined}
                    timestamp={post.createdAt}
                    size="medium"
                />
                <div onClick={(e) => e.stopPropagation()}>
                    {actionsNode}
                </div>
            </div>

            <div style={{ padding: '12px 16px' }}>
                <h4 className="mt-0 mb-6" style={{ textAlign: 'left' }}>{post.title || '(无标题)'}</h4>

                <p className="muted mb-8 text-14 line-clamp-2" style={{ textAlign: 'left' }}>{post.excerpt || '(无内容)'}</p>

                {post.shareType === 'record' && post.shareRefId && (
                    <div className="mb-8 community-board-embed">
                        <RecordEmbed
                            recordId={post.shareRefId}
                            recordSnapshot={post.shareReference}
                            allowFetch={!!post.shareReference}
                        />
                    </div>
                )}
                {post.shareType === 'board' && post.shareRefId && (
                    <div className="mb-8 community-board-embed">
                        <BoardEmbed boardId={post.shareRefId} enableSave={false} />
                    </div>
                )}

                {post.tags && post.tags.length > 0 && (
                    <div className="row-start gap-4 mb-8 flex-wrap">
                        {post.tags.slice(0, 3).map((t: string, idx: number) => (
                            <span key={idx} className="badge badge-light text-12">{t}</span>
                        ))}
                        {post.tags.length > 3 && (
                            <span className="badge badge-light text-12">+{post.tags.length - 3}</span>
                        )}
                    </div>
                )}

                <div className="row-start gap-12 text-12 muted">
                    <span>👍 {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                </div>
            </div>
        </div>
    )
}
