import React from 'react'
import { useParams } from 'react-router-dom'
import PostDetail from '../../features/community/PostDetail'

export default function AdminPostDetail() {
    const { postId } = useParams<{ postId: string }>()
    // Reuse community PostDetail component inside admin layout.
    // PostDetail reads postId from params and displays post; admin-only controls may be added later.
    return <PostDetail />
}
