import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import LiveBattle from './LiveBattle';

// Basic smoke test: renders title and buttons before entering room
describe('LiveBattle component', () => {
    it('renders title and create/match buttons when not in room and no action param', () => {
        render(
            <MemoryRouter initialEntries={['/app/live']}>
                <LiveBattle />
            </MemoryRouter>
        );
        expect(screen.getByText('在线对战')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '创建房间' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '快速匹配' })).toBeInTheDocument();
    });

    it('shows creating banner when action=create', () => {
        render(
            <MemoryRouter initialEntries={['/app/live?action=create']}>
                <LiveBattle />
            </MemoryRouter>
        );
        const nodes = screen.getAllByText(/正在创建房间/);
        expect(nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows matching banner when action=match', () => {
        render(
            <MemoryRouter initialEntries={['/app/live?action=match']}>
                <LiveBattle />
            </MemoryRouter>
        );
        expect(screen.getByText(/正在为你匹配/)).toBeInTheDocument();
    });
});
