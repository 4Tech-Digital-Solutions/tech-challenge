import { Campo, InputDirective, InputMascara } from './input';

export { Campo, InputDirective, InputMascara } from './input';
export type { TipoMascara } from './input';

export const INPUT_UI = [Campo, InputDirective, InputMascara] as const;
