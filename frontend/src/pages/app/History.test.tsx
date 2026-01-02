import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import History from './History'

const mocks = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockPrefsGet: vi.fn(),
    mockPrefsUpdate: vi.fn(),
    mockGetMe: vi.fn(),
}))

vi.mock('../../features/records/recordStore', () => ({
    __esModule: true,
    recordStore: {
        list: mocks.mockList,
        remove: vi.fn(),
        saveNew: vi.fn(),
    },
}))

vi.mock('../../services/api', () => ({
    __esModule: true,
    recordsApi: {
        prefs: {
            get: mocks.mockPrefsGet,
            update: mocks.mockPrefsUpdate,
        },
        favorite: vi.fn(),
        unfavorite: vi.fn(),
        update: vi.fn(),
    },
    userApi: {
        getMe: mocks.mockGetMe,
        getById: vi.fn().mockResolvedValue({ id: 1, nickname: 'me' }),
    },
}))

const setup = () =>
    render(
        <MemoryRouter>
            <History />
        </MemoryRouter>,
    )

describe('History page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.mockPrefsGet.mockResolvedValue({ keepLimit: 30 })
        mocks.mockPrefsUpdate.mockResolvedValue({})
        mocks.mockGetMe.mockResolvedValue({ id: 1, nickname: 'me' })
        mocks.mockList.mockResolvedValue([])
    })

    it('shows empty message when no records', async () => {
        setup()

        expect(await screen.findByText('暂无记录')).toBeInTheDocument()
    })

    it('updates keepLimit via settings popover', async () => {
        setup()

        const settingsBtn = await screen.findByLabelText('记录保留设置')
        fireEvent.click(settingsBtn)

        const input = screen.getByLabelText('保留条数') as HTMLInputElement
        fireEvent.change(input, { target: { value: '50' } })

        await waitFor(() => {
            expect(mocks.mockPrefsUpdate).toHaveBeenCalledWith({ keepLimit: 50 })
        })
        expect(input.value).toBe('50')
    })
})
