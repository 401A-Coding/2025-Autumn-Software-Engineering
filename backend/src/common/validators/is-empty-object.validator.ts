import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

/**
 * 验证器：确保值是一个空对象（{}）
 */
@ValidatorConstraint({ name: 'isEmptyObject', async: false })
export class IsEmptyObject implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments) {
        // 必须是对象类型，且不是数组，且没有任何自有属性
        return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0
        );
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property}必须是空对象（{}），不允许包含任何属性`;
    }
}