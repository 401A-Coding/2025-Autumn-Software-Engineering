import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import History from './History'
import { recordStore } from '../../features/records/recordStore'

vi.mock('../../features/records/recordStore')

const mockList = vi.mocked(recordStore.list)

const setup = () =>
    render(
        <MemoryRouter>
            <History />
        </MemoryRouter>,
    )

describe('History page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('shows empty message when no records', () => {
        mockList.mockReturnValue([] as any)

        setup()

        expect(screen.getByText('暂无记录')).toBeInTheDocument()
    })

    it('shows favorite empty message when switching to favorites', () => {
        mockList.mockReturnValue([] as any)

        setup()

        const favTab = screen.getByRole('button', { name: '收藏' })
        fireEvent.click(favTab)

        expect(screen.getByText('暂无收藏')).toBeInTheDocument()
    })

    it('persists keepLimit setting to localStorage', () => {
        mockList.mockReturnValue([] as any)

        setup()

        // 先展开设置面板
        const settingsBtn = screen.getByRole('button', { name: '记录保留设置' })
        fireEvent.click(settingsBtn)

        const input = screen.getByLabelText('保留条数') as HTMLInputElement
        fireEvent.change(input, { target: { value: '50' } })

        expect(localStorage.getItem('record.keepLimit')).toBe('50')
    })
})
