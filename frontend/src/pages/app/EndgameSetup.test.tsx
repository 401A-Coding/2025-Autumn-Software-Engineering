import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EndgameSetup from './EndgameSetup'

describe('EndgameSetup highlights', () => {
    it('renders highlight overlays for invalid squares from validateBoard', async () => {
        const pieces = [
            // put an elephant on an illegal square (e.g., red elephant at y=0)
            { type: 'elephant', side: 'red', x: 0, y: 0 },
            // two generals to make board otherwise parsable
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 4, y: 0 },
        ] as any

        const { container } = render(
            <MemoryRouter initialEntries={[{ pathname: '/app/endgame', state: { layout: { pieces }, name: 't' } }]}>
                <EndgameSetup />
            </MemoryRouter>,
        )

        // expect validation message to be shown
        await screen.findByText(/象放置位置不合法|象放置位置不合法/)

        const highlights = container.querySelectorAll('.cell-highlight')
        expect(highlights.length).toBeGreaterThan(0)

        // ensure the specific illegal cell (0,0) is highlighted
        const target = container.querySelector('.cell-highlight.cell-x-0.cell-y-0') || container.querySelector('.cell-x-0.cell-y-0.cell-highlight')
        expect(target).toBeTruthy()
    })
})
