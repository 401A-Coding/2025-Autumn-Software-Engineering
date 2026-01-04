import { useMemo } from 'react'
import http from '../../lib/http'

export default function AdminDocs() {
    const apiBase = (http as any).defaults?.baseURL || 'http://localhost:3000'
    const swaggerUrl = useMemo(() => `${apiBase}/docs`, [apiBase])

    return (
        <div className="p-4">
            <h2 className="text-xl mb-3">API 文档</h2>
            <p>点击下方按钮在新标签打开 Swagger UI：</p>
            <div style={{ marginTop: 12 }}>
                <a className="btn-ghost" href={swaggerUrl} target="_blank" rel="noreferrer">打开 Swagger UI</a>
            </div>
        </div>
    )
}
