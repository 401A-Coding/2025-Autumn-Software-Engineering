import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LocalPlay from './LocalPlay'
import { recordStore } from '../../features/records/recordStore'
import Board from '../../features/chess/Board'

const navigateMock = vi.fn()

vi.mock('../../features/chess/Board', () => {
    return {
        __esModule: true,
        default: vi.fn(() => <div data-testid="mock-board" />),
    }
})

vi.mock('../../features/records/recordStore')

vi.mock('react-router-dom', async () => {
    const actual = await import('react-router-dom')
    return {
        __esModule: true,
        ...actual,
        useNavigate: () => navigateMock,
    }
})

const mockSaveNew = vi.mocked(recordStore.saveNew)

const setup = () =>
    render(
        <MemoryRouter>
            <LocalPlay />
        </MemoryRouter>,
    )

describe('LocalPlay page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        navigateMock.mockClear()
    })

    it('renders title and exit button', () => {
        setup()

        expect(screen.getByText('本地对战')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '退出对局' })).toBeInTheDocument()
        expect(screen.getByTestId('mock-board')).toBeInTheDocument()
    })

    it('shows and hides exit confirm dialog', () => {
        setup()

        const exitBtn = screen.getByRole('button', { name: '退出对局' })
        fireEvent.click(exitBtn)

        expect(screen.getByRole('dialog', { name: '是否保存当前对局？' })).toBeInTheDocument()

        const cancelBtn = screen.getByRole('button', { name: '取消' })
        fireEvent.click(cancelBtn)

        expect(screen.queryByRole('dialog', { name: '是否保存当前对局？' })).not.toBeInTheDocument()
    })

    it('clicking "不保存退出" just navigates home without saving', () => {
        setup()

        const exitBtn = screen.getByRole('button', { name: '退出对局' })
        fireEvent.click(exitBtn)

        const noSaveBtn = screen.getByRole('button', { name: '不保存退出' })
        fireEvent.click(noSaveBtn)

        expect(mockSaveNew).not.toHaveBeenCalled()
        expect(navigateMock).toHaveBeenCalledWith('/app/home')
    })

    it('save and exit persists record and navigates home', () => {
        const BoardMock = vi.mocked(Board as any) as any
        const movesHandlers: any[] = []
        BoardMock.mockImplementation(({ onMove }: any) => {
            if (onMove) movesHandlers.push(onMove)
            return <div data-testid="mock-board" />
        })

        setup()

        // 模拟两步走子
        movesHandlers.forEach((h) => h({ from: 'a1', to: 'a2' }))
        movesHandlers.forEach((h) => h({ from: 'b1', to: 'b2' }))

        const exitBtn = screen.getByRole('button', { name: '退出对局' })
        fireEvent.click(exitBtn)

        const saveBtn = screen.getByRole('button', { name: '保存并退出' })
        fireEvent.click(saveBtn)

        expect(mockSaveNew).toHaveBeenCalledTimes(1)
        const arg = mockSaveNew.mock.calls[0][0]
        expect(arg.opponent).toBe('本地')
        expect(Array.isArray(arg.moves)).toBe(true)
        expect(arg.moves.length).toBe(2)
        expect(navigateMock).toHaveBeenCalledWith('/app/home')
    })
})
