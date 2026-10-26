// Validaciones en el cliente, tomadas de docs/ritech-prototipo.html
// (src/logica/validaciones.js y src/logica/acceso.js). Devuelven mensajes en lenguaje claro.
import { RULES } from './util';

export const MSG = Object.freeze({
  required: 'Este campo es obligatorio.',
  capitalFormat: 'Escribe el monto solo con números, por ejemplo 1.000.000 o 1000,50.',
  capitalPositive: 'El capital debe ser un número mayor que cero.',
  decimals: 'Usa máximo dos decimales.',
  variationFormat: 'Escribe un porcentaje, por ejemplo 2, −1,25 o −1,25 %.',
});

type Parsed = { ok: true; value: number } | { ok: false; error: string };

/** Un campo con solo espacios cuenta como vacío. */
export const isBlank = (s: unknown) => s == null || String(s).trim() === '';

/**
 * Interpreta el capital aceptando separadores de miles con punto o coma y como máximo dos decimales.
 * Si aparecen ambos separadores, el último es el decimal; si aparece uno solo una vez, precedido de
 * 1 a 3 dígitos y seguido de exactamente tres, es separador de miles; en otro caso es el decimal.
 */
export function parseCapital(input: string): Parsed {
  if (isBlank(input)) return { ok: false, error: MSG.required };
  const s = String(input).trim();
  if (/^[-−]/.test(s)) return { ok: false, error: MSG.capitalPositive };
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, error: MSG.capitalFormat };

  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let intPart = s, decPart = '', thousandsSep: string | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = lastDot > lastComma ? '.' : ',';
    thousandsSep = decSep === '.' ? ',' : '.';
    const i = s.lastIndexOf(decSep);
    intPart = s.slice(0, i); decPart = s.slice(i + 1);
    if (intPart.includes(decSep)) return { ok: false, error: MSG.capitalFormat };
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const count = s.split(sep).length - 1;
    const after = s.slice(s.lastIndexOf(sep) + 1);
    const before = s.slice(0, s.indexOf(sep));
    if (count > 1 || (after.length === 3 && /^[1-9]\d{0,2}$/.test(before))) {
      thousandsSep = sep; // 1.000 / 1,000 / 1.000.000
    } else {
      intPart = s.slice(0, s.lastIndexOf(sep)); decPart = after;
    }
  }

  if (thousandsSep) {
    const groups = intPart.split(thousandsSep);
    const okGroups = /^[1-9]\d{0,2}$/.test(groups[0]) && groups.slice(1).every(g => /^\d{3}$/.test(g));
    if (!okGroups) return { ok: false, error: MSG.capitalFormat };
    intPart = groups.join('');
  }
  if (intPart === '' || !/^\d+$/.test(intPart) || (decPart && !/^\d+$/.test(decPart))) {
    return { ok: false, error: MSG.capitalFormat };
  }
  if (decPart.length > RULES.maxDecimals) return { ok: false, error: MSG.decimals };

  const value = Number(intPart + (decPart ? '.' + decPart : ''));
  if (!(value > 0)) return { ok: false, error: MSG.capitalPositive };
  return { ok: true, value };
}

/**
 * Interpreta la variación del índice: signo + o −, coma o punto decimal y símbolo % opcional;
 * máximo dos decimales y rango entre −100 y +100.
 */
export function parseVariation(input: string): Parsed {
  if (isBlank(input)) return { ok: false, error: MSG.required };
  const s = String(input).trim().replace(/−/g, '-').replace(/\s*%$/, '');
  const m = /^([+-]?)(\d+)(?:[.,](\d+))?$/.exec(s);
  if (!m) return { ok: false, error: MSG.variationFormat };
  if (m[3] && m[3].length > RULES.maxDecimals) return { ok: false, error: MSG.decimals };
  const value = Number((m[1] === '-' ? '-' : '') + m[2] + (m[3] ? '.' + m[3] : ''));
  if (value < RULES.varMin || value > RULES.varMax) {
    return { ok: false, error: `La variación debe estar entre −${Math.abs(RULES.varMin)} % y +${RULES.varMax} %.` };
  }
  return { ok: true, value: value === 0 ? 0 : value };
}

export type SimField = 'capital' | 'variation';

/** Valida el formulario completo: todos los errores a la vez y el primer campo inválido para el foco. */
export function validarSimulacion({ capital, variation }: Record<SimField, string>) {
  const c = parseCapital(capital), v = parseVariation(variation);
  const errors: Partial<Record<SimField, string>> = {};
  if (!c.ok) errors.capital = c.error;
  if (!v.ok) errors.variation = v.error;
  const firstInvalid: SimField | null = errors.capital ? 'capital' : errors.variation ? 'variation' : null;
  const values = c.ok && v.ok ? { capital: c.value, variation: v.value } : null;
  return { ok: !firstInvalid, errors, firstInvalid, values };
}

/** Campos obligatorios vacíos, en orden de aparición. */
export const camposVacios = (v: Record<SimField, string>) =>
  (['capital', 'variation'] as const).filter(k => isBlank(v[k]));

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Formato y campos obligatorios del inicio de sesión, antes de consultar al backend. */
export function validarLogin(email: string, password: string) {
  const em = String(email || '').trim().toLowerCase(), pw = String(password || '');
  const errors: { email?: string; password?: string } = {};
  if (!em) errors.email = 'Ingresa tu correo.';
  else if (!EMAIL_RE.test(em)) errors.email = 'Escribe un correo válido, por ejemplo nombre@ritech.co.';
  if (!pw) errors.password = 'Ingresa tu contraseña.';
  return { ok: Object.keys(errors).length === 0, errors };
}
