import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorBanner, Icon, IndexChart, Panel as Box, RangeSeg, Sig, SkeletonBlock, useAsync, useTitle, type Range } from '../components';
import type { ChartPoint, CycleHistoryItem } from '../types';
import { SIGNAL_ES, dmy, fmtT, isoDay, r2, shortReason } from '../util';

type Kind = 'COMPRAR' | 'VENDER' | 'MANTENER' | 'SIN';
const KINDS: Kind[] = ['COMPRAR', 'VENDER', 'MANTENER', 'SIN'];
const LBL: Record<Kind, string> = { COMPRAR: 'COMPRAR', VENDER: 'VENDER', MANTENER: 'MANTENER', SIN: 'Sin recomendación' };
const kind = (c: CycleHistoryItem): Kind => (c.type && SIGNAL_ES[c.type]) || 'SIN';

/** Filtros compartidos mientras dura la sesión. */
const saved = { types: [...KINDS] as Kind[], from: '', to: '', range: '5d' as Range };

export default function Historicos() {
  useTitle('Históricos');
  const nav = useNavigate();
  const [types, setTypesS] = useState<Kind[]>(saved.types);
  const [from, setFromS] = useState(saved.from);
  const [to, setToS] = useState(saved.to);
  const [range, setRangeS] = useState<Range>(saved.range);
  const setTypes = (v: Kind[]) => { saved.types = v; setTypesS(v); };
  const setFrom = (v: string) => { saved.from = v; setFromS(v); };
  const setTo = (v: string) => { saved.to = v; setToS(v); };
  const setRange = (v: Range) => { saved.range = v; setRangeS(v); };

  const hist = useAsync(() => api.marketHistory(range) as Promise<ChartPoint[]>, [range]);
  const { data, loading, error } = useAsync(() => api.reportHistory() as Promise<CycleHistoryItem[]>, []);

  const bad = Boolean(from && to && from > to);
  const inRange = (data ?? []).filter(c => { const d = isoDay(c.time); return (!from || d >= from) && (!to || d <= to); });
  const cnt = (k: Kind) => inRange.filter(c => kind(c) === k).length;
  const rows = bad ? [] : inRange.filter(c => types.includes(kind(c))).sort((a, b) => b.time.localeCompare(a.time));
  const toggle = (k: Kind) => setTypes(types.includes(k) ? types.filter(x => x !== k) : [...types, k]);
  const clear = () => { setTypes([...KINDS]); setFrom(''); setTo(''); };
  const open = (c: CycleHistoryItem) => { if (c.alertId != null) nav(`/alertas/${c.alertId}`); };

  return (
    <>
      <div className="page-head"><h1>Históricos</h1><p>NASDAQ 100 y todas las señales emitidas por el sistema</p></div>
      <Box title="NASDAQ 100 y RSI" right={<RangeSeg value={range} onChange={setRange} />}>
        <div className="panel-body">
          {hist.loading ? <div className="sk-block" aria-busy="true" aria-label="Cargando gráfico" style={{ marginTop: 0 }} />
            : hist.error ? <ErrorBanner error={hist.error} /> : <IndexChart points={hist.data ?? []} range={range} />}
        </div>
      </Box>
      <div className="filters" role="group" aria-label="Filtros" style={{ marginTop: 12 }}>
        <div className="fgroup"><span>Resultado del ciclo</span>
          <div className="chips">
            {KINDS.map(k => (
              <button key={k} type="button" className={`chip c-${k}`} aria-pressed={types.includes(k)} onClick={() => toggle(k)}>
                <b>{LBL[k]}</b><span className="n num">{loading ? '…' : cnt(k)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fgroup"><span>Desde</span><input className="date-in" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Fecha inicial" /></div>
        <div className="fgroup"><span>Hasta</span><input className="date-in" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Fecha final" /></div>
        <button type="button" className="linkish" onClick={clear}>Limpiar filtros</button>
        <span className="f-count num" aria-live="polite">{loading ? 'Cargando…' : `${rows.length} ciclos`}</span>
        {bad && <div className="f-error"><Icon name="alert" size={14} />La fecha inicial es posterior a la final.</div>}
      </div>
      {loading ? <SkeletonBlock /> : error ? <ErrorBanner error={error} /> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Hora</th><th className="r">Cierre</th><th className="r">RSI (14)</th><th>Resultado del ciclo</th><th>Motivo o causa</th></tr></thead>
            <tbody>
              {rows.map((c, i) => {
                const link = c.alertId != null;
                return (
                  <tr key={`${c.time}-${i}`} className={link ? undefined : 'nolink'} tabIndex={link ? 0 : undefined}
                    onClick={() => open(c)} onKeyDown={e => { if (e.key === 'Enter') open(c); }}>
                    <td className="num">{dmy(isoDay(c.time))}</td>
                    <td className="num">{fmtT(c.time)}</td>
                    <td className="r num">{r2(c.indexValue)}</td>
                    <td className="r num">{c.rsi != null ? r2(c.rsi) : <span className="muted">—</span>}</td>
                    <td><Sig type={c.type} /></td>
                    <td>{c.type
                      ? <>{shortReason(c.rsi, c.condition)}{/alta volatilidad/i.test(c.condition ?? '') && <> <span className="a-vol"><Icon name="alert" size={12} />Alta volatilidad</span></>}</>
                      : <span className="t-warn">{c.reason || c.cycleStatus || '—'}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <div className="empty"><b>No hay ciclos con estos filtros</b>Activa otro resultado o amplía el rango de fechas.<br />
            <button type="button" className="btn btn-ghost" onClick={clear}>Limpiar filtros</button></div>}
        </div>
      )}
    </>
  );
}
