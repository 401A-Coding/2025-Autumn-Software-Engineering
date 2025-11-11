type Props = {
    labels: [string, string]
    activeIndex: 0 | 1
    onChange: (index: 0 | 1) => void
}

export default function Segmented({ labels, activeIndex, onChange }: Props) {
    return (
        <div className="segmented" role="tablist" aria-label="记录收藏切换">
            <div
                className="segmented__slider"
                style={{ transform: `translateX(${activeIndex === 0 ? '0%' : '100%'})` }}
                aria-hidden
            />
            <button
                role="tab"
                aria-selected={activeIndex === 0}
                className={`segmented__item ${activeIndex === 0 ? 'is-active' : ''}`}
                onClick={() => onChange(0)}
            >
                {labels[0]}
            </button>
            <button
                role="tab"
                aria-selected={activeIndex === 1}
                className={`segmented__item ${activeIndex === 1 ? 'is-active' : ''}`}
                onClick={() => onChange(1)}
            >
                {labels[1]}
            </button>
        </div>
    )
}
