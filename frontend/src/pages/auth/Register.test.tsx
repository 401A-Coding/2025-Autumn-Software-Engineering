import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'
import http from '../../lib/http'

vi.mock('../../lib/http')

const setup = () =>
    render(
        <MemoryRouter>
            <Register />
        </MemoryRouter>,
    )

describe('Register page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('submits register form and calls http.post with correct payload', async () => {
        const mockedPost = vi
            .mocked(http.post)
            .mockResolvedValue({ data: {} } as any)

        setup()

        const phoneInput = screen.getByPlaceholderText('请输入手机号')
        const passwordInput = screen.getByPlaceholderText('请输入密码')
        const submitBtn = screen.getByRole('button', { name: '注册' })

        fireEvent.change(phoneInput, { target: { value: '13800000000' } })
        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(mockedPost).toHaveBeenCalledWith('/api/v1/auth/register', {
                type: 'phone',
                phone: '13800000000',
                password: 'password123',
            })
        })
    })

    it('shows error message when register fails', async () => {
        vi.mocked(http.post).mockRejectedValue(new Error('注册失败'))

        setup()

        const phoneInput = screen.getByPlaceholderText('请输入手机号')
        const passwordInput = screen.getByPlaceholderText('请输入密码')
        const submitBtn = screen.getByRole('button', { name: '注册' })

        fireEvent.change(phoneInput, { target: { value: '13800000000' } })
        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.click(submitBtn)

        expect(await screen.findByText(/注册失败|错误：注册失败/)).toBeInTheDocument()
    })
})
