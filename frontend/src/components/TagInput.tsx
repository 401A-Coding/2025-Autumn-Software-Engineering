import { useState } from 'react'

interface TagInputProps {
    tags: string[]
    onChange: (tags: string[]) => void
    maxTags?: number
    placeholder?: string
}

export default function TagInput({
    tags,
    onChange,
    maxTags = 5,
    placeholder = '添加标签',
}: TagInputProps) {
    const [inputValue, setInputValue] = useState('')
    const [error, setError] = useState('')

    const handleAddTag = () => {
        const trimmed = inputValue.trim()
        if (!trimmed) return

        if (tags.length >= maxTags) {
            setError(`最多只能添加 ${maxTags} 个标签`)
            return
        }

        if (tags.includes(trimmed)) {
            setError('标签已存在')
            return
        }

        if (trimmed.length > 20) {
            setError('标签长度不能超过20个字符')
            return
        }

        onChange([...tags, trimmed])
        setInputValue('')
        setError('')
    }

    const handleRemoveTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index))
        setError('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAddTag()
        }
    }

    return (
        <div>
            {/* 标签列表 */}
            {tags.length > 0 && (
                <div className="row-start gap-8 mb-8 flex-wrap">
                    {tags.map((tag, index) => (
                        <div
                            key={index}
                            className="badge badge-light row-start gap-4 align-center"
                            style={{ paddingRight: 6 }}
                        >
                            <span>{tag}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(index)}
                                className="btn-icon-sm"
                                style={{
                                    padding: 0,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#999',
                                    fontSize: 14,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 输入框 */}
            <div className="row-start gap-8">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={tags.length >= maxTags}
                    className="flex-1"
                    maxLength={20}
                />
                <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!inputValue.trim() || tags.length >= maxTags}
                    className="btn-ghost"
                >
                    ➕ 添加
                </button>
            </div>

            {/* 提示信息 */}
            <div className="text-12 muted mt-4">
                {error ? (
                    <span style={{ color: '#d32f2f' }}>{error}</span>
                ) : (
                    <span>
                        {tags.length} / {maxTags} 个标签
                        {tags.length > 0 && '，按 Enter 键快速添加'}
                    </span>
                )}
            </div>
        </div>
    )
}
