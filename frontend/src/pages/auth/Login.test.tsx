import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import Login from './Login'
import http from '../../lib/http'
import { setTokens } from '../../lib/auth'

vi.mock('../../lib/http')
vi.mock('../../lib/auth')
vi.mock('react-router-dom', async () => {
    const actual = await import('react-router-dom')
    return {
        __esModule: true,
        ...actual,
        useNavigate: vi.fn(),
    }
})

const setup = () =>
    render(
        <MemoryRouter>
            <Login />
        </MemoryRouter>,
    )

describe('Login page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows validation error for invalid phone or short password', async () => {
        setup()

        const submitBtn = screen.getByRole('button', { name: '登录' })
        fireEvent.click(submitBtn)

        expect(await screen.findByText('请输入合法的手机号')).toBeInTheDocument()

        const phoneInput = screen.getByPlaceholderText('请输入手机号')
        fireEvent.change(phoneInput, { target: { value: '13800000000' } })
        fireEvent.click(submitBtn)

        expect(await screen.findByText('密码至少 6 位')).toBeInTheDocument()
    })

    it('submits login form and calls http.post with correct payload', async () => {
        const mockedPost = vi
            .mocked(http.post)
            .mockResolvedValue({
                data: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            } as any)

        setup()

        const phoneInput = screen.getByPlaceholderText('请输入手机号')
        const passwordInput = screen.getByPlaceholderText('至少 6 位')
        const submitBtn = screen.getByRole('button', { name: '登录' })

        fireEvent.change(phoneInput, { target: { value: '13800000000' } })
        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(mockedPost).toHaveBeenCalledWith('/api/v1/auth/login', {
                type: 'phone',
                phone: '13800000000',
                password: 'password123',
            })
        })

        await waitFor(() => {
            expect(setTokens).toHaveBeenCalledWith({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            })
        })
    })

    it('sets error when request fails', async () => {
        vi.mocked(http.post).mockRejectedValue(new Error('网络错误'))

        setup()

        const phoneInput = screen.getByPlaceholderText('请输入手机号')
        const passwordInput = screen.getByPlaceholderText('至少 6 位')
        const submitBtn = screen.getByRole('button', { name: '登录' })

        fireEvent.change(phoneInput, { target: { value: '13800000000' } })
        fireEvent.change(passwordInput, { target: { value: 'password123' } })
        fireEvent.click(submitBtn)

        expect(await screen.findByText('网络错误')).toBeInTheDocument()
    })
})
