import { useEffect, useRef, useState } from 'react'

export interface MenuAction {
    label: string
    onClick: () => void
    danger?: boolean
    disabled?: boolean
}

interface DropdownMenuProps {
    actions: MenuAction[]
    position?: 'top' | 'bottom'
}

export default function DropdownMenu({ actions, position = 'bottom' }: DropdownMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: '4px 8px',
                    color: '#666',
                    lineHeight: 1,
                }}
                aria-label="更多操作"
            >
                ···
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        ...(position === 'top' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
                        left: 0,
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: 4,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        minWidth: 120,
                        zIndex: 1000,
                    }}
                >
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            disabled={action.disabled}
                            onClick={() => {
                                if (action.disabled) return
                                action.onClick()
                                setOpen(false)
                            }}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'transparent',
                                cursor: action.disabled ? 'not-allowed' : 'pointer',
                                fontSize: 14,
                                color: action.disabled ? '#999' : (action.danger ? '#d32f2f' : '#333'),
                                opacity: action.disabled ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!action.disabled) {
                                    e.currentTarget.style.backgroundColor = '#f5f5f5'
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
