import React from 'react'

type Props = {
    children: React.ReactNode
    title?: string
    className?: string
}

export default function MobileFrame({ children, title, className }: Props) {
    return (
        <div className="mobile-root">
            <div className={"mobile-viewport" + (className ? ` ${className}` : '')}>
                {title ? (
                    <div className="mobile-header">
                        <h1 className="mobile-header__title">{title}</h1>
                    </div>
                ) : null}
                <div className="mobile-content">
                    {children}
                </div>
            </div>
        </div>
    )
}
