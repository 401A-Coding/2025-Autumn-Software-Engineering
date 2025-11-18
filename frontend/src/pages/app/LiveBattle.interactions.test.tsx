import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveBattle from './LiveBattle';
import { vi, describe, it, expect } from 'vitest';

// Mocks
const createMock = vi.fn(async () => ({ battleId: 123 }));
const cancelMock = vi.fn(async (id: number) => ({ battleId: id, cancelled: true }));
const getMeMock = vi.fn(async () => ({ id: 1 }));

type Snap = {
    battleId: number;
    status: 'waiting' | 'playing' | 'finished';
    mode: string;
    players: number[];
    moves: unknown[];
    turnIndex: 0 | 1;
    board: object;
    turn: 'red' | 'black';
    createdAt: number;
    winnerId: number | null;
};

let snapshotHandler: ((s: Snap) => void) | null = null;
const mockConn = {
    socket: { on: vi.fn(), close: vi.fn() },
    join: vi.fn(),
    snapshot: vi.fn(),
    move: vi.fn(),
    onSnapshot: (cb: (s: Snap) => void) => { snapshotHandler = cb; },
    onMove: vi.fn(),
    onPlayerJoin: vi.fn(),
};

vi.mock('../../services/api', () => ({
    battleApi: {
        create: () => createMock(),
        cancel: (id: number) => cancelMock(id),
    },
    userApi: {
        getMe: () => getMeMock(),
    },
}));

vi.mock('../../services/battlesSocket', () => ({
    connectBattle: () => mockConn,
}));

describe('LiveBattle interactions', () => {
    it('shows cancel button in waiting state for creator and calls cancel', async () => {
        render(
            <MemoryRouter initialEntries={["/app/live?action=create"]}>
                <LiveBattle />
            </MemoryRouter>
        );

        // create should be called
        await waitFor(() => expect(createMock).toHaveBeenCalled());

        // simulate server snapshot: waiting with single player being me
        snapshotHandler?.({
            battleId: 123,
            status: 'waiting',
            mode: 'pvp',
            players: [1],
            moves: [],
            turnIndex: 0,
            board: {},
            turn: 'red',
            createdAt: Date.now(),
            winnerId: null,
        });

        // cancel button should appear
        const cancelBtn = await screen.findByRole('button', { name: '取消匹配' });
        fireEvent.click(cancelBtn);

        await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(123));
    });
});
