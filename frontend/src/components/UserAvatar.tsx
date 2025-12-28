import { useNavigate } from 'react-router-dom'

interface UserAvatarProps {
    userId: number
    nickname?: string
    avatarUrl?: string
    timestamp?: string
    size?: 'small' | 'medium' | 'large'
    showTime?: boolean
    onClick?: () => void
    nicknameWrap?: boolean
    nicknameClassName?: string
    stackVertical?: boolean
}

export default function UserAvatar({
    userId,
    nickname,
    avatarUrl,
    timestamp,
    size = 'medium',
    showTime = true,
    onClick,
    nicknameWrap = false,
    nicknameClassName,
    stackVertical = false,
}: UserAvatarProps) {
    const navigate = useNavigate()

    const sizeMap = {
        small: 32,
        medium: 40,
        large: 48,
    }

    const avatarSize = sizeMap[size]

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onClick) {
            onClick()
        } else {
            navigate(`/app/users/${userId}`)
        }
    }

    const getInitials = (name?: string) => {
        if (!name) return '?'
        return name.slice(0, 2).toUpperCase()
    }

    const formatTime = (time?: string) => {
        if (!time) return ''
        const date = new Date(time)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return '刚刚'
        if (minutes < 60) return `${minutes}分钟前`
        if (hours < 24) return `${hours}小时前`
        if (days < 7) return `${days}天前`
        return date.toLocaleDateString('zh-CN')
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: stackVertical ? 'column' : 'row',
                alignItems: 'center',
                gap: stackVertical ? 6 : 8,
            }}
        >
            {/* 头像 */}
            <div
                className="cursor-pointer"
                onClick={handleClick}
                style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: '50%',
                    backgroundColor: avatarUrl ? 'transparent' : '#e0e0e0',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={nickname || '用户'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span
                        style={{
                            fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
                            fontWeight: 600,
                            color: '#666',
                        }}
                    >
                        {getInitials(nickname)}
                    </span>
                )}
            </div>

            {/* 用户信息：昵称在上、日期在下；当 stackVertical=true 时显示在头像下方 */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 0,
                    alignItems: stackVertical ? 'center' : undefined,
                }}
            >
                <div
                    onClick={handleClick}
                    className={nicknameClassName}
                    style={nicknameWrap ? {
                        cursor: 'pointer',
                        fontWeight: 600,
                        color: '#333',
                        lineHeight: 1.2,
                    } : {
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: size === 'small' ? 12 : 14,
                        color: '#333',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {nickname || '匿名用户'}
                </div>
                {showTime && timestamp && (
                    <div
                        style={{
                            fontSize: 12,
                            color: '#666',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {formatTime(timestamp)}
                    </div>
                )}
            </div>
        </div>
    )
}
