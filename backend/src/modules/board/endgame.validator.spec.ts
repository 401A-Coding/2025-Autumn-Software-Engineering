import { validateEndgamePieces } from './endgame.validator';

describe('endgame.validator', () => {
  it('detects overlap', () => {
    const pieces = [
      { type: 'general', side: 'red', x: 4, y: 9 },
      { type: 'general', side: 'black', x: 4, y: 0 },
      { type: 'rook', side: 'red', x: 0, y: 0 },
      { type: 'rook', side: 'black', x: 0, y: 0 },
    ] as any;
    const r = validateEndgamePieces(pieces);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (it: any) => it.code === 'overlap' || it.message.includes('重叠'),
      ),
    ).toBe(true);
  });

  it('detects illegal elephant', () => {
    const pieces = [
      { type: 'elephant', side: 'red', x: 0, y: 0 },
      { type: 'general', side: 'red', x: 4, y: 9 },
      { type: 'general', side: 'black', x: 4, y: 0 },
    ] as any;
    const r = validateEndgamePieces(pieces);
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (it: any) =>
          it.code === 'elephant_square' ||
          it.message.includes('象放置位置不合法'),
      ),
    ).toBe(true);
  });

  it('passes minimal valid generals', () => {
    const pieces = [
      { type: 'general', side: 'red', x: 4, y: 9 },
      { type: 'general', side: 'black', x: 3, y: 0 },
    ] as any;
    const r = validateEndgamePieces(pieces);
    expect(r.valid).toBe(true);
  });
});
