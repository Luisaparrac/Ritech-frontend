import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadingStore, ApiError } from './api';
import type { ChartPoint, Simulation } from './types';
import { RSI, RULES, dmy, fmtDT, fmtT, isoDay, money, r2, sMoney, sPct, signalEs, tone } from './util';

/* ---------- Íconos (objeto ICONS del prototipo) ---------- */
const ICONS = {
  grid: 'M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z',
  bell: 'M10 17.5a2 2 0 0 0 2-2H8a2 2 0 0 0 2 2zM15 13V9a5 5 0 0 0-10 0v4l-1.5 2h13z',
  calc: 'M5 2.5h10v15H5zM7.5 5h5v3h-5zM7.5 10.5h1M11.5 10.5h1M7.5 13.5h1M11.5 13.5h1',
  clock: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 6v4l2.5 2',
  line: 'M2.5 15.5l4.5-5 3 3 6.5-8M2.5 17.5h15',
  bars: 'M4 17V10M8 17V5M12 17v-8M16 17V3M2.5 17.5h15',
  out: 'M8 3.5H4.5v13H8M12 6.5l3.5 3.5-3.5 3.5M15.5 10H8',
  alert: 'M10 3l7.5 13h-15zM10 8v3.5M10 13.8v.2',
  mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
  check: 'M4 10.5l4 4 8-9',
  dash: 'M5 10h10',
  back: 'M12 4.5L6.5 10l5.5 5.5',
};
export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => (
  <svg className="i" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

export const Brand = () => (
  <div className="brand">
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="23" rx="4" fill="none" stroke="#2E3743" />
      <path d="M5 16l4-4 3 2 7-7" fill="none" stroke="#5B8DEF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19l4-2.5 3 1 7-4" fill="none" stroke="#8B95A4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
    </svg>
    <span>RiTech <small>SAS</small></span>
  </div>
);

/** Chip de señal: recibe BUY/SELL/HOLD del backend y muestra COMPRAR/VENDER/MANTENER. */
export const Sig = ({ type, lg = false }: { type?: string | null; lg?: boolean }) => {
  const s = signalEs(type);
  return s ? <span className={`sig sig-${s}${lg ? ' sig-lg' : ''}`}>{s}</span> : <span className="muted">Sin recomendación</span>;
};

/** Error junto a su campo, con ícono de alerta. */
export const FieldError = ({ id, msg }: { id: string; msg?: string }) => (
  <div className="field-error" id={id} hidden={!msg}>{msg && <><Icon name="alert" size={14} /><span>{msg}</span></>}</div>
);

/** Medidor de RSI con marcas en 30 y 70. */
export const Gauge = ({ value }: { value: number }) => (
  <>
    <div className="gauge" aria-hidden="true">
      <i style={{ left: `${RSI.oversold}%` }} /><i style={{ left: `${RSI.overbought}%` }} />
      <b style={{ left: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
    <div className="gauge-l num" aria-hidden="true"><span>0</span><span>{RSI.oversold}</span><span>{RSI.overbought}</span><span>100</span></div>
  </>
);

/* ---------- Estados de carga y error ---------- */
export function GlobalLoader() {
  const [s, setS] = useState({ pending: 0, slow: false });
  useEffect(() => loadingStore.subscribe(setS), []);
  if (!s.pending) return null;
  return (
    <div className="loader-bar" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {s.slow ? 'Despertando el servidor… la primera carga puede tardar hasta un minuto.' : 'Cargando…'}
    </div>
  );
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Ocurrió un error inesperado. Intenta de nuevo.');

export const ErrorBanner = ({ error }: { error: unknown }) =>
  error ? <div className="banner warn" role="alert"><Icon name="alert" size={16} /><div>{errorText(error)}</div></div> : null;

export const SkeletonKpis = ({ n = 4 }: { n?: number }) => (
  <div className={`kpis${n === 6 ? ' k6' : ''}`} aria-hidden="true">
    {Array.from({ length: n }, (_, i) => <div className="kpi" key={i}><span className="sk sk-w80" /><span className="sk sk-big" /><span className="sk sk-w110" /></div>)}
  </div>
);
export const SkeletonBlock = () => <div className="panel sk-block" aria-busy="true" aria-label="Cargando" />;

/* ---------- Hooks ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    fn().then(d => alive && setData(d)).catch(e => alive && setError(e)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick(t => t + 1) };
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query); const h = () => setMatch(m.matches);
    m.addEventListener('change', h); h();
    return () => m.removeEventListener('change', h);
  }, [query]);
  return match;
}

export function useTitle(title: string) {
  useEffect(() => { document.title = `${title} — RiTech SAS`; }, [title]);
}

/* ---------- Selector de intervalo 1d / 5d ---------- */
export type Range = '1d' | '5d';
export const RangeSeg = ({ value, onChange, label = 'Intervalo del gráfico' }: { value: Range; onChange: (r: Range) => void; label?: string }) => (
  <div className="seg" role="group" aria-label={label}>
    {(['1d', '5d'] as const).map(r => (
      <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}>{r === '1d' ? 'Hoy' : '5 días'}</button>
    ))}
  </div>
);

/* ---------- Gráfico del índice con RSI y señales ---------- */
const isFail = (p: ChartPoint) => /ERROR|FAIL/i.test(p.cycleStatus ?? '');

export function IndexChart({ points, range }: { points: ChartPoint[]; range: Range }) {
  const data = points.filter(p => p.close !== null && p.close !== undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; left: number } | null>(null);
  if (data.length < 2) return <div className="empty"><b>Sin datos para graficar</b>Aún no hay suficientes cierres en este intervalo.</div>;

  const W = 800, H1 = 220, G = 22, H2 = 90, P = 8, R = 58;
  const n = data.length, step = (W - P - R) / Math.max(n - 1, 1), xs = (i: number) => P + i * step;
  const cl = data.map(c => Number(c.close)), mn = Math.min(...cl), mx = Math.max(...cl), pad = (mx - mn) * 0.08 || 1;
  const yP = (v: number) => P + (H1 - 2 * P) * (1 - (v - (mn - pad)) / ((mx + pad) - (mn - pad)));
  const yR = (v: number) => H1 + G + H2 * (1 - v / 100);
  const price = data.map((c, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${yP(Number(c.close)).toFixed(1)}`).join(' ');
  let rsi = '', started = false;
  data.forEach((c, i) => { if (c.rsi == null) { started = false; return; } rsi += `${started ? 'L' : 'M'}${xs(i).toFixed(1)} ${yR(c.rsi).toFixed(1)} `; started = true; });
  const days = data.map(c => isoDay(c.time));
  const hasFail = data.some(isFail);

  const move = (e: React.MouseEvent) => {
    const b = svgRef.current!.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - P) / step)));
    setHover({ i, left: Math.min(Math.max(xs(i) * b.width / W - 90, 0), b.width - 190) });
  };
  const h = hover ? data[hover.i] : null;

  return (
    <>
      <div className="chart-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H1 + G + H2 + 22}`} className="ichart" role="img" aria-label="Gráfico del NASDAQ 100 con RSI (14) y señales emitidas"
          onMouseMove={move} onMouseLeave={() => setHover(null)}>
          <g fontSize="10" fill="var(--faint)">
            {[mx, (mx + mn) / 2, mn].map((v, k) => <text key={k} x={W - R + 6} y={yP(v) + 3}>{r2(v)}</text>)}
            {range === '1d'
              ? data.map((c, i) => fmtT(c.time).endsWith(':00') ? <text key={i} x={xs(i)} y={H1 + G + H2 + 16} textAnchor="middle">{fmtT(c.time)}</text> : null)
              : data.map((c, i) => (i === 0 || days[i - 1] !== days[i]) ? (
                <g key={i}>
                  {i > 0 && <line x1={xs(i)} x2={xs(i)} y1={0} y2={H1 + G + H2} stroke="var(--line)" />}
                  <text x={xs(i) + 4} y={H1 + G + H2 + 16}>{dmy(days[i]).slice(0, 5)}</text>
                </g>) : null)}
            <text x={0} y={H1 + G - 6}>RSI ({RSI.period})</text>
            <text x={W - R + 6} y={yR(RSI.overbought) + 3}>{RSI.overbought}</text>
            <text x={W - R + 6} y={yR(RSI.oversold) + 3}>{RSI.oversold}</text>
          </g>
          <rect x={0} y={0} width={W - R} height={H1} fill="none" stroke="var(--line)" />
          <rect x={0} y={H1 + G} width={W - R} height={H2} fill="none" stroke="var(--line)" />
          <line x1={0} x2={W - R} y1={yR(RSI.overbought)} y2={yR(RSI.overbought)} stroke="var(--faint)" strokeDasharray="3 3" />
          <line x1={0} x2={W - R} y1={yR(RSI.oversold)} y2={yR(RSI.oversold)} stroke="var(--faint)" strokeDasharray="3 3" />
          <path d={price} fill="none" stroke="var(--text)" strokeWidth="1.4" opacity=".85" />
          <path d={rsi} fill="none" stroke="var(--accent)" strokeWidth="1.3" />
          {data.map((c, i) => {
            const x = xs(i);
            if (c.recommendation === 'BUY') { const y = yP(Number(c.close)) + 9; return <path key={i} d={`M${x} ${y - 5}L${x - 4.5} ${y + 3}H${x + 4.5}Z`} fill="var(--up)"><title>COMPRAR {fmtT(c.time)}</title></path>; }
            if (c.recommendation === 'SELL') { const y = yP(Number(c.close)) - 9; return <path key={i} d={`M${x} ${y + 5}L${x - 4.5} ${y - 3}H${x + 4.5}Z`} fill="var(--down)"><title>VENDER {fmtT(c.time)}</title></path>; }
            if (isFail(c)) return <line key={i} x1={x} x2={x} y1={P} y2={H1 + G + H2} stroke="var(--warn)" strokeDasharray="2 3" opacity=".7"><title>Ciclo sin datos válidos</title></line>;
            return null;
          })}
          {hover && h && (
            <g>
              <line y1={0} y2={H1 + G + H2} x1={xs(hover.i)} x2={xs(hover.i)} stroke="var(--muted)" strokeWidth="1" />
              <circle r="3.5" fill="var(--text)" cx={xs(hover.i)} cy={yP(Number(h.close))} />
              {h.rsi != null && <circle r="3" fill="var(--accent)" cx={xs(hover.i)} cy={yR(h.rsi)} />}
            </g>
          )}
          <rect className="hit" x={0} y={0} width={W - R} height={H1 + G + H2} fill="transparent" />
        </svg>
        {hover && h && (
          <div className="xtip" style={{ left: hover.left }}>
            <b>{dmy(isoDay(h.time))} {fmtT(h.time)}</b>
            <span>Cierre <b className="num">{r2(h.close)}</b></span>
            {h.rsi != null ? <span>RSI <b className="num">{r2(h.rsi)}</b></span> : <span>Datos insuficientes para el RSI</span>}
            {h.recommendation ? <span className={`sig sig-${signalEs(h.recommendation)}`}>{signalEs(h.recommendation)}</span>
              : isFail(h) ? <span className="t-warn">Sin recomendación: ciclo sin datos válidos</span> : null}
          </div>
        )}
      </div>
      <div className="chart-legend">
        <span><i className="lg lg-p" />NASDAQ 100</span><span><i className="lg lg-r" />RSI ({RSI.period})</span>
        <span><i className="tri up" />COMPRAR</span><span><i className="tri down" />VENDER</span>
        {hasFail && <span><i className="lg lg-e" />Ciclo sin datos válidos</span>}
      </div>
    </>
  );
}

/* ---------- Mini gráfico del día con el instante de la señal ---------- */
export function DayChart({ points, at, signal, rsi }: { points: ChartPoint[]; at: string; signal?: string | null; rsi?: number | null }) {
  const day = points.filter(p => p.close !== null && p.close !== undefined);
  if (day.length < 2) return <p className="muted small">Sin datos suficientes del día para graficar.</p>;
  const W = 420, H1 = 120, H2 = 64, G = 14, P = 6;
  const xs = (i: number) => P + i * (W - 2 * P) / Math.max(day.length - 1, 1);
  const cl = day.map(c => Number(c.close)), mn = Math.min(...cl), mx = Math.max(...cl);
  const yP = (v: number) => P + (H1 - 2 * P) * (1 - (v - mn) / (mx - mn || 1));
  const yR = (v: number) => H1 + G + H2 * (1 - v / 100);
  const priceLine = day.map((c, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${yP(Number(c.close)).toFixed(1)}`).join(' ');
  let rsiLine = '', started = false;
  day.forEach((c, i) => { if (c.rsi == null) return; rsiLine += `${started ? 'L' : 'M'}${xs(i).toFixed(1)} ${yR(c.rsi).toFixed(1)} `; started = true; });
  const t = new Date(at).getTime();
  let si = 0; day.forEach((c, i) => { if (Math.abs(new Date(c.time).getTime() - t) < Math.abs(new Date(day[si].time).getTime() - t)) si = i; });
  const sp = day[si], sRsi = rsi ?? sp.rsi;
  const s = signalEs(signal);
  const col = s === 'COMPRAR' ? 'var(--up)' : s === 'VENDER' ? 'var(--down)' : 'var(--text)';
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H1 + G + H2 + 4}`} role="img" aria-label={`Gráfico del NASDAQ 100 y del RSI del ${dmy(isoDay(at))} con la señal de las ${fmtT(at)} marcada`}>
        <rect x="0" y="0" width={W} height={H1} fill="none" stroke="var(--line)" />
        <path d={priceLine} fill="none" stroke="var(--muted)" strokeWidth="1.4" />
        <rect x="0" y={H1 + G} width={W} height={H2} fill="none" stroke="var(--line)" />
        <line x1="0" x2={W} y1={yR(RSI.overbought)} y2={yR(RSI.overbought)} stroke="var(--faint)" strokeDasharray="3 3" />
        <line x1="0" x2={W} y1={yR(RSI.oversold)} y2={yR(RSI.oversold)} stroke="var(--faint)" strokeDasharray="3 3" />
        <text x="4" y={yR(RSI.overbought) - 3} fontSize="9" fill="var(--faint)">{RSI.overbought}</text>
        <text x="4" y={yR(RSI.oversold) + 10} fontSize="9" fill="var(--faint)">{RSI.oversold}</text>
        <text x="0" y={H1 + G - 3} fontSize="9" fill="var(--faint)">RSI ({RSI.period})</text>
        <path d={rsiLine} fill="none" stroke="var(--accent)" strokeWidth="1.3" />
        <line x1={xs(si)} x2={xs(si)} y1="0" y2={H1 + G + H2} stroke={col} strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={xs(si)} cy={yP(Number(sp.close))} r="4" fill={col} stroke="var(--surface)" strokeWidth="1.5" />
        {sRsi != null && <circle cx={xs(si)} cy={yR(sRsi)} r="3.5" fill={col} stroke="var(--surface)" strokeWidth="1.5" />}
      </svg>
      <div className="legend num">
        <span>{fmtT(day[0].time)}</span>
        <span>Señal {fmtT(at)}: {r2(sp.close)} pts{sRsi != null ? `, RSI ${r2(sRsi)}` : ''}</span>
        <span>{fmtT(day[day.length - 1].time)}</span>
      </div>
    </>
  );
}

/* ---------- Resultado de una simulación (simulador y detalle del historial) ---------- */
export function ResultView({ r }: { r: Simulation }) {
  const c = r.currency || 'COP';
  const rec = r.recommendationAtSimulation;
  return (
    <>
      <div className="final-label">Valor final de la inversión</div>
      <div className="final-value num">{money(r.finalValue, c)} <span className="cur">{c}</span></div>
      <div className={`final-delta num ${tone(r.resultAmount)}`}>{sMoney(r.resultAmount, c)}<span className="sep">/</span>{sPct(r.resultPercent)}</div>
      <table className="breakdown" aria-label="Desglose del cálculo">
        <tbody>
          <tr><td>Capital inicial</td><td>{money(r.capital, c)}</td></tr>
          <tr><td>Variación del NASDAQ 100</td><td className={tone(r.variation)}>{sPct(r.variation)}</td></tr>
          <tr><td>Regla aplicada</td><td>× {RULES.multiplier}</td></tr>
          <tr><td>Resultado porcentual</td><td className={tone(r.resultPercent)}>{sPct(r.resultPercent)}</td></tr>
          <tr><td>Resultado en dinero <span className="sub">(capital × resultado porcentual)</span></td><td className={tone(r.resultAmount)}>{sMoney(r.resultAmount, c)}</td></tr>
          <tr className="total"><td>Valor final <span className="sub">(capital + resultado)</span></td><td>{money(r.finalValue, c)}</td></tr>
        </tbody>
      </table>
      {r.capped && (
        <div className="note cap"><Icon name="alert" size={16} /><div>
          Una caída de {sPct(r.variation)} equivale a {sPct(r.rawPercent ?? Number(r.variation) * RULES.multiplier)} con la regla ×{RULES.multiplier}. La pérdida se limita al 100 % del capital, por eso el valor final es {money(0, c)}.
        </div></div>
      )}
      <div className="note"><Icon name="alert" size={16} /><div>
        El riesgo máximo de esta inversión es perder la totalidad del capital invertido: <b className="num">{money(r.maxLoss ?? r.capital, c)}</b> (100 %).
      </div></div>
      {r.warning && <div className="note cap"><Icon name="alert" size={16} /><div>{r.warning}</div></div>}
      {rec && (
        <div className="rec-line">Recomendación vigente al simular: <Sig type={rec.type} /> <span className="num">{fmtDT(rec.time)}</span> <Link to={`/alertas/${rec.id}`}>Ver por qué</Link></div>
      )}
    </>
  );
}

/* ---------- Panel genérico ---------- */
export const Panel = ({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`panel ${className}`}>
    <div className="panel-head"><h2>{title}</h2>{right}</div>
    {children}
  </section>
);
