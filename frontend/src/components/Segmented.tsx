import React from 'react'

export type SegmentedOption = {
    label: React.ReactNode
    value: string
}

interface SegmentedProps {
    options: SegmentedOption[]
    value: string
    onChange: (value: string) => void
}

export default function Segmented({ options, value, onChange }: SegmentedProps) {
    return (
        <div style={{
            display: 'inline-flex',
            border: '1px solid var(--control-border)',
            borderRadius: 999,
            padding: 2,
            background: 'var(--control-bg)',
            userSelect: 'none'
        }}>
            {options.map((opt) => {
                const active = opt.value === value
                return (
                    <button
                        type="button"
                        key={String(opt.value)}
                        onClick={() => onChange(opt.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            cursor: 'pointer',
                            background: active ? 'var(--control-bg-active)' : 'transparent',
                            color: active ? 'var(--control-text)' : 'var(--control-text-muted)',
                            borderRadius: 999,
                            padding: '6px 14px',
                            boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all .15s ease'
                        }}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}
