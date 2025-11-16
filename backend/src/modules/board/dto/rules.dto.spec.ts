import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { RulesDto } from './rules.dto';

describe('RulesDto validation', () => {
  it('accepts minimal valid rules', () => {
    const dto = new RulesDto();
    dto.layoutSource = 'empty';
    // minimal pieceRules can be empty object (no overrides)
    dto.pieceRules = {};

    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid layoutSource', () => {
    const dto = new RulesDto();
    // 通过绕过类型系统构造非法值（仅用于测试）
    (dto as unknown as Record<string, unknown>).layoutSource = 'invalid';
    (dto as unknown as Record<string, unknown>).pieceRules = {};

    const errors = validateSync(dto as object);
    expect(errors.length).toBeGreaterThan(0);
    const layoutErr = errors.find((e) => e.property === 'layoutSource');
    expect(layoutErr).toBeTruthy();
  });

  it('rejects missing pieceRules when provided rules object', () => {
    const dto = new RulesDto();
    dto.layoutSource = 'empty';
    // pieceRules intentionally missing
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const prErr = errors.find((e) => e.property === 'pieceRules');
    expect(prErr).toBeTruthy();
  });
});
