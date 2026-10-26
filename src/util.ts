// Formato de cifras y fechas, tomado de docs/ritech-prototipo.html (src/logica/formato.js).
// Dos decimales es-CO, signo explícito con el menos tipográfico y fechas en hora de Colombia.

export const CURRENCIES = {
  COP: { code: 'COP', symbol: '$', name: 'pesos colombianos' },
  USD: { code: 'USD', symbol: 'US$', name: 'dólares estadounidenses' },
} as const;
export type Currency = keyof typeof CURRENCIES;
export const DEFAULT_CURRENCY: Currency = 'COP';

/** Regla de simulación: resultado = variación × 2, con pérdida máxima del 100 %. */
export const RULES = Object.freeze({ multiplier: 2, varMin: -100, varMax: 100, maxLossPct: 100, maxDecimals: 2 });
/** Límites del RSI usados en los textos y medidores. */
export const RSI = Object.freeze({ period: 14, oversold: 30, overbought: 70 });

const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MINUS = '−';
export const DASH = '—';

/** true si el valor es un número finito (acepta números como texto). */
export const isNum = (n: unknown): n is number | string =>
  n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));

/** Número con dos decimales en formato colombiano, sin signo. */
export const r2 = (n: unknown) => (isNum(n) ? nf2.format(Number(n)) : DASH);

/** Signo explícito: + para positivos, − para negativos y nada para cero. */
export const sign = (n: number) => (n > 0 ? '+' : n < 0 ? MINUS : '');

const cur = (code?: string) => CURRENCIES[(code as Currency)] ?? CURRENCIES[DEFAULT_CURRENCY];

/** Importe sin signo con el símbolo de la moneda. */
export const money = (n: unknown, code?: string) =>
  isNum(n) ? cur(code).symbol + nf2.format(Math.abs(Number(n))) : DASH;

/** Importe con signo explícito. */
export const sMoney = (n: unknown, code?: string) => (isNum(n) ? sign(Number(n)) + money(n, code) : DASH);

/** Porcentaje con signo explícito y dos decimales: "+1,25 %". */
export const sPct = (n: unknown) => (isNum(n) ? sign(Number(n)) + nf2.format(Math.abs(Number(n))) + ' %' : DASH);

/** Porcentaje sin signo: "66,67 %". */
export const pct = (n: unknown) => (isNum(n) ? nf2.format(Number(n)) + ' %' : DASH);

/** Clase de color según el signo: ganancia, pérdida o neutro. */
export const tone = (n: unknown) => (!isNum(n) ? 'neutral' : Number(n) > 0 ? 'up' : Number(n) < 0 ? 'down' : 'neutral');

/** Entero o "—". */
export const int = (n: unknown) => (isNum(n) ? String(Math.round(Number(n))) : DASH);

/** Fecha ISO (AAAA-MM-DD) a DD/MM/AAAA. */
export const dmy = (d: string) => d.split('-').reverse().join('/');

// ---- Fechas: el backend envía -05:00; se muestran siempre en hora de Colombia ----
export const TZ = 'America/Bogota';
const valid = (iso?: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d; };

/** Día (AAAA-MM-DD) de una fecha ISO en hora de Colombia. */
export const isoDay = (iso?: string | null) => { const d = valid(iso); return d ? d.toLocaleDateString('en-CA', { timeZone: TZ }) : ''; };
/** DD/MM/AAAA. */
export const fmtD = (iso?: string | null) => { const d = valid(iso); return d ? d.toLocaleDateString('es-CO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : DASH; };
/** HH:MM (24 h). */
export const fmtT = (iso?: string | null, timeZone = TZ) => {
  const d = valid(iso); if (!d) return DASH;
  return d.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
};
/** DD/MM/AAAA a las HH:MM. */
export const fmtDT = (iso?: string | null) => (valid(iso) ? `${fmtD(iso)} a las ${fmtT(iso)}` : DASH);
/** "Lunes, 26 de octubre" a partir de AAAA-MM-DD. */
export const dayLabel = (d: string) => {
  const s = new Date(d + 'T12:00:00Z').toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** Identificador legible de una recomendación: REC-AAAAMMDD-HHMM (hora de Colombia). */
export const recId = (iso?: string | null) => (valid(iso) ? `REC-${isoDay(iso).replace(/-/g, '')}-${fmtT(iso).replace(':', '')}` : DASH);

// ---- Textos del dominio ----
export type Signal = 'COMPRAR' | 'VENDER' | 'MANTENER';
export const SIGNAL_ES: Record<string, Signal> = { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER' };
export const SIGNAL_EN: Record<Signal, string> = { COMPRAR: 'BUY', VENDER: 'SELL', MANTENER: 'HOLD' };
export const MARKET_ES: Record<string, string> = { OPEN: 'Abierto', CLOSED: 'Cerrado', PRE_MARKET: 'Preapertura' };
export const signalEs = (s?: string | null): Signal | null => (s ? SIGNAL_ES[s] ?? null : null);
export const marketEs = (s?: string | null) => (s && MARKET_ES[s]) || DASH;
export const ROLE_LABEL: Record<string, string> = { USER: 'Usuario', MANAGER: 'Gerente de RiTech' };

/** Quita la marca "(alta volatilidad)" de la condición cuando ya se muestra aparte. */
export const plainCond = (c?: string | null) => (c ?? '').replace(/\s*\(alta volatilidad\)\s*/i, '').trim();
/** Motivo resumido para listados: "RSI 28,40 en sobreventa". */
export const shortReason = (rsi: unknown, cond?: string | null) =>
  isNum(rsi) ? `RSI ${r2(rsi)}${plainCond(cond) ? ' en ' + plainCond(cond) : ''}` : plainCond(cond) || DASH;
export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** N.º de simulación con cuatro dígitos. */
export const simNo = (id: unknown) => String(id ?? '').padStart(4, '0');
