import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { DayChart, ErrorBanner, Gauge, Icon, Sig, SkeletonBlock, useAsync, useMedia, useTitle } from '../components';
import type { AlertDetail, AlertListItem } from '../types';
import { RSI, SIGNAL_ES, dayLabel, dmy, fmtT, isNum, isoDay, r2, recId, sPct, shortReason } from '../util';

const TYPES = ['BUY', 'SELL', 'HOLD'] as const;
const PAGE = 100; // tamaño máximo de página que acepta el backend

/** Filtros compartidos mientras dura la sesión (como en el prototipo). */
const saved = { types: ['BUY', 'SELL'] as string[], from: '', to: '' };

async function fetchAll(from: string, to: string) {
  const out: AlertListItem[] = [];
  for (let page = 0; page < 30; page++) {
    const rows = await api.alerts({ types: TYPES.join(','), from: from || undefined, to: to || undefined, page: String(page), size: String(PAGE) }) as AlertListItem[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
}

export default function Alertas() {
  useTitle('Alertas');
  const { id } = useParams();
  const nav = useNavigate();
  const wide = useMedia('(min-width: 1081px)');
  const [types, setTypesState] = useState<string[]>(saved.types);
  const [from, setFromState] = useState(saved.from);
  const [to, setToState] = useState(saved.to);
  const setTypes = (t: string[]) => { saved.types = t; setTypesState(t); };
  const setFrom = (v: string) => { saved.from = v; setFromState(v); };
  const setTo = (v: string) => { saved.to = v; setToState(v); };

  const badRange = Boolean(from && to && from > to);
  const all = useAsync(() => badRange ? Promise.resolve([]) : fetchAll(from, to), [from, to, badRange]);
  const rows = all.data ?? [];
  const count = (t: string) => rows.filter(r => r.type === t).length;
  const list = rows.filter(r => types.includes(r.type));

  const selId = id ?? (wide && list[0] ? String(list[0].id) : null);
  const detail = useAsync(() => selId ? api.alert(selId) as Promise<AlertDetail> : Promise.resolve(null), [selId]);
  const detailRef = useRef<HTMLElement>(null);

  // En pantallas angostas el detalle se abre a pantalla completa y recibe el foco.
  useEffect(() => { if (id && !wide) detailRef.current?.focus(); }, [id, wide]);

  const clear = () => { setTypes(['BUY', 'SELL']); setFrom(''); setTo(''); };
  const toggle = (t: string) => setTypes(types.includes(t) ? types.filter(x => x !== t) : [...types, t]);
  const open = (a: AlertListItem) => nav(`/alertas/${a.id}`, { replace: true });
  const close = () => {
    nav('/alertas', { replace: true });
    const cur = document.querySelector<HTMLElement>(`.arow[data-id="${selId}"]`); cur?.focus();
  };

  let lastDay = '';
  return (
    <>
      <div className="page-head">
        <h1>Alertas</h1>
        <p>Una recomendación cada 5 minutos; horas en hora de Colombia</p>
      </div>
      <div className="filters" role="group" aria-label="Filtros">
        <div className="fgroup"><span>Tipo de señal</span>
          <div className="chips">
            {TYPES.map(t => (
              <button key={t} type="button" className={`chip c-${SIGNAL_ES[t]}`} aria-pressed={types.includes(t)} onClick={() => toggle(t)}>
                <b>{SIGNAL_ES[t]}</b><span className="n num">{all.loading ? '…' : count(t)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fgroup"><span>Desde</span><input className="date-in" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Fecha inicial" /></div>
        <div className="fgroup"><span>Hasta</span><input className="date-in" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Fecha final" /></div>
        <button type="button" className="linkish" onClick={clear}>Limpiar filtros</button>
        <span className="f-count num" aria-live="polite">{all.loading ? 'Cargando…' : `${list.length} ${list.length === 1 ? 'alerta' : 'alertas'}`}</span>
        {badRange && <div className="f-error"><Icon name="alert" size={14} />La fecha inicial es posterior a la final. Corrige el rango para ver alertas.</div>}
      </div>

      <div className="alerts">
        <section className="alist" aria-label="Listado de alertas" aria-busy={all.loading}>
          {all.loading ? <SkeletonBlock />
            : all.error ? <div className="panel-body"><ErrorBanner error={all.error} /></div>
            : list.length ? list.map(a => {
              const day = isoDay(a.time); const head = day !== lastDay; lastDay = day;
              return (
                <Fragment key={a.id}>
                  {head && <div className="aday">{dayLabel(day)}</div>}
                  <button type="button" className="arow" data-id={a.id} aria-current={String(a.id) === selId ? 'true' : undefined} onClick={() => open(a)}>
                    <Sig type={a.type} />
                    <span className="a-time">{fmtT(a.time)}</span>
                    <span className="a-reason">{shortReason(a.rsi, a.condition)}</span>
                    {a.volatility ? <span className="a-vol"><Icon name="alert" size={13} />Alta volatilidad</span> : <span />}
                  </button>
                </Fragment>
              );
            })
            : <div className="empty"><b>No hay alertas con estos filtros</b>Prueba con otro tipo de señal o amplía el rango de fechas.<br />
              <button type="button" className="btn btn-ghost" onClick={clear}>Limpiar filtros</button></div>}
        </section>

        <aside ref={detailRef} className={`detail${selId ? '' : ' is-empty'}`} aria-label="Detalle de la alerta" tabIndex={-1}
          onKeyDown={e => { if (e.key === 'Escape' && !wide && selId) close(); }}>
          {!selId ? <div className="d-empty">Selecciona una alerta para ver por qué se emitió.</div>
            : detail.loading ? <div className="d-empty"><span className="sk sk-w110" /></div>
            : detail.error ? <div className="d-sec"><ErrorBanner error={detail.error} /><button type="button" className="btn btn-ghost d-close" onClick={close}>Cerrar</button></div>
            : detail.data && <Detail d={detail.data} onClose={close} />}
        </aside>
      </div>
    </>
  );
}

function Detail({ d, onClose }: { d: AlertDetail; onClose: () => void }) {
  const t = d.traceability ?? {}; const du = t.dataUsed ?? {};
  return (
    <>
      <div className="d-head">
        <div>
          <Sig type={d.type} />
          <div className="when">
            Emitida el {dmy(isoDay(d.emittedAt))} a las {fmtT(d.emittedAt)}, hora de Colombia
            {d.emittedAtNewYork && ` (${fmtT(d.emittedAtNewYork, 'America/New_York')} en Nueva York)`}
          </div>
        </div>
        <button type="button" className="btn btn-ghost d-close" onClick={onClose}>Cerrar</button>
      </div>
      <div className="d-sec">
        <h3>Por qué se emitió</h3>
        <p className="explain">{d.explanation || 'Sin explicación disponible.'}</p>
        {d.volatilityWarning && <div className="vol-warn"><Icon name="alert" size={16} /><div>{d.volatilityWarning}</div></div>}
        {isNum(d.rsi) && <div style={{ marginTop: 14 }}>
          <div className="kpi-lab">RSI (14): <b className="num" style={{ color: 'var(--text)' }}>{r2(d.rsi)}</b></div>
          <Gauge value={Number(d.rsi)} />
        </div>}
        <p className="rsi-help">El RSI mide de 0 a 100 la fuerza de las subidas y bajadas recientes del índice. Por encima de {RSI.overbought} indica que subió demasiado rápido; por debajo de {RSI.oversold}, que cayó demasiado rápido.</p>
      </div>
      <div className="d-sec">
        <h3>Criterios evaluados</h3>
        {d.criteria?.length ? (
          <table className="crit">
            <thead><tr><th>Criterio</th><th style={{ textAlign: 'right', paddingRight: 12 }}>Observado</th><th>Resultado</th></tr></thead>
            <tbody>
              {d.criteria.map((c, i) => (
                <tr key={i}>
                  <td>{c.criterion}</td><td>{c.observed}</td>
                  <td>{c.met ? <span className="ok-yes"><Icon name="check" size={14} />Cumple</span> : <span className="ok-no"><Icon name="dash" size={14} />No cumple</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted small">El servidor no envió criterios para esta alerta.</p>}
      </div>
      <div className="d-sec chart">
        <h3>NASDAQ 100 y RSI del {dmy(isoDay(d.emittedAt))}</h3>
        <DayChart points={d.dayChart ?? []} at={d.emittedAt} signal={d.type} rsi={d.rsi} />
      </div>
      <div className="d-sec">
        <h3>Trazabilidad</h3>
        <dl className="trace-dl">
          <dt>Identificador</dt><dd>{recId(d.emittedAt)}</dd>
          <dt>Fuente</dt><dd>{isNum(du.marketDataId) ? `Registro de mercado N.º ${du.marketDataId}` : '—'}</dd>
          <dt>Dato usado</dt><dd>{isNum(du.indexValue) ? `Cierre de ${r2(du.indexValue)} pts${isNum(du.changePercent) ? ` (${sPct(du.changePercent)})` : ''}` : '—'}</dd>
          <dt>Ventana</dt><dd>{du.windowStart && du.windowEnd ? `${fmtT(du.windowStart)}–${fmtT(du.windowEnd)} (hora de Colombia)` : '—'}</dd>
          <dt>Periodo</dt><dd>{t.period || '—'}</dd>
          <dt>Criterio</dt><dd>{t.rule || '—'}</dd>
          <dt>Emisión</dt><dd>{t.emission ? `${dmy(isoDay(t.emission))} ${fmtT(t.emission)} (hora de Colombia)` : '—'}</dd>
          <dt>Recibida por</dt><dd>{t.receivedBy || '—'}</dd>
        </dl>
      </div>
      <div className="d-sec no-exec"><Icon name="alert" size={16} /><div>La plataforma no ejecuta operaciones de compra o venta. Esta recomendación es un apoyo para tu decisión.</div></div>
    </>
  );
}
