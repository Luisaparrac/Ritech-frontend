import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, session } from '../api';
import { ErrorBanner, Icon, ResultView, Sig, SkeletonBlock, useAsync, useTitle } from '../components';
import type { Simulation } from '../types';
import { CURRENCIES, RULES, fmtD, fmtDT, fmtT, isoDay, money, r2, sMoney, sPct, signalEs, simNo, tone } from '../util';

/** Filtros compartidos mientras dura la sesión. */
const saved = { q: '', from: '', to: '' };

/** Texto de búsqueda sin puntos, espacios, $ ni %, para que "1.000.000 $" encuentre 1000000. */
const norm = (s: string) => s.trim().toLowerCase().replace(/[.\s$%]/g, '');

function haystack(s: Simulation) {
  const rec = signalEs(s.recommendationAtSimulation?.type);
  return [
    simNo(s.id), String(s.id ?? ''), String(Math.round(Number(s.capital))), r2(s.capital), r2(s.variation), sPct(s.variation),
    String(s.variation), rec ?? '', s.currency ?? '',
  ].map(norm).join(' ');
}

export default function Historial() {
  const { id } = useParams();
  return id ? <SimDetail id={id} /> : <SimList />;
}

function SimList() {
  useTitle('Mi historial');
  const nav = useNavigate();
  const [q, setQ] = useState(saved.q);
  const [from, setFrom] = useState(saved.from);
  const [to, setTo] = useState(saved.to);
  const set = (k: 'q' | 'from' | 'to', v: string) => { saved[k] = v; ({ q: setQ, from: setFrom, to: setTo })[k](v); };
  const { data, loading, error } = useAsync(() => api.simulations() as Promise<Simulation[]>, []);

  const all = data ?? [];
  const bad = Boolean(from && to && from > to);
  const needle = norm(q);
  const rows = bad ? [] : all
    .filter(s => { const d = isoDay(s.createdAt); return (!from || d >= from) && (!to || d <= to); })
    .filter(s => !needle || haystack(s).includes(needle))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')); // más reciente primero
  const clear = () => { set('q', ''); set('from', ''); set('to', ''); };
  const open = (s: Simulation) => nav(`/mi-historial/${s.id}`);

  return (
    <>
      <div className="page-head"><h1>Mi historial</h1>
        <p>{loading ? 'Cargando…' : `${all.length} ${all.length === 1 ? 'simulación guardada' : 'simulaciones guardadas'}`}</p></div>
      {loading ? <SkeletonBlock /> : error ? <ErrorBanner error={error} /> : !all.length ? (
        <div className="panel"><div className="empty"><b>Aún no tienes simulaciones</b>Cada simulación que hagas se guarda aquí automáticamente.<br />
          <Link className="btn btn-ghost" to="/simulador">Hacer una simulación</Link></div></div>
      ) : (
        <>
          <div className="filters" role="search">
            <div className="fgroup grow"><span>Buscar</span>
              <input className="date-in search" type="search" value={q} onChange={e => set('q', e.target.value)} placeholder="N.º, capital, variación o recomendación" aria-label="Buscar simulaciones" /></div>
            <div className="fgroup"><span>Desde</span><input className="date-in" type="date" value={from} onChange={e => set('from', e.target.value)} aria-label="Fecha inicial" /></div>
            <div className="fgroup"><span>Hasta</span><input className="date-in" type="date" value={to} onChange={e => set('to', e.target.value)} aria-label="Fecha final" /></div>
            <button type="button" className="linkish" onClick={clear}>Limpiar filtros</button>
            <span className="f-count num" aria-live="polite">{rows.length} de {all.length}</span>
            {bad && <div className="f-error"><Icon name="alert" size={14} />La fecha inicial es posterior a la final.</div>}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>N.º</th><th>Fecha</th><th className="r">Capital</th><th className="r">Variación</th><th className="r">Resultado</th>
                <th className="r">Resultado en dinero</th><th className="r">Valor final</th><th>Recomendación vigente</th></tr></thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} tabIndex={0} onClick={() => open(s)} onKeyDown={e => { if (e.key === 'Enter') open(s); }}>
                    <td className="num">{simNo(s.id)}</td>
                    <td className="num">{fmtD(s.createdAt)} <span className="muted">{fmtT(s.createdAt)}</span></td>
                    <td className="r num">{money(s.capital, s.currency)} <span className="muted">{s.currency}</span></td>
                    <td className={`r num ${tone(s.variation)}`}>{sPct(s.variation)}</td>
                    <td className={`r num ${tone(s.resultPercent)}`}>{sPct(s.resultPercent)}</td>
                    <td className={`r num ${tone(s.resultAmount)}`}>{sMoney(s.resultAmount, s.currency)}</td>
                    <td className="r num">{money(s.finalValue, s.currency)}</td>
                    <td>{s.recommendationAtSimulation ? <Sig type={s.recommendationAtSimulation.type} /> : <span className="muted">Sin datos</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div className="empty"><b>Ninguna simulación coincide</b>Cambia la búsqueda o el rango de fechas.<br />
              <button type="button" className="btn btn-ghost" onClick={clear}>Limpiar filtros</button></div>}
          </div>
        </>
      )}
    </>
  );
}

function SimDetail({ id }: { id: string }) {
  useTitle(`Simulación N.º ${simNo(id)}`);
  const { data: s, loading, error } = useAsync(() => api.simulation(id) as Promise<Simulation>, [id]);
  const back = <Link className="back" to="/mi-historial"><Icon name="back" size={14} />Volver a mi historial</Link>;

  if (loading) return <>{back}<SkeletonBlock /></>;
  if (error || !s) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403);
    return <>{back}{notFound
      ? <div className="panel"><div className="empty"><b>No se encontró la simulación N.º {simNo(id)}</b>Puede que no exista o que pertenezca a otra cuenta.<br />
        <Link className="btn btn-ghost" to="/mi-historial">Ver mi historial</Link></div></div>
      : <ErrorBanner error={error} />}</>;
  }
  const cur = CURRENCIES[s.currency as keyof typeof CURRENCIES];
  return (
    <>
      {back}
      <div className="page-head"><h1>Simulación N.º {simNo(s.id)}</h1><p>{fmtDT(s.createdAt)} (hora de Colombia)</p></div>
      <div className="sim">
        <section className="panel">
          <div className="panel-head"><h2>Datos utilizados</h2></div>
          <div className="panel-body">
            <dl className="trace-dl">
              <dt>Capital</dt><dd>{money(s.capital, s.currency)} {s.currency}</dd>
              <dt>Moneda</dt><dd>{cur?.name ?? s.currency ?? '—'}</dd>
              <dt>Variación</dt><dd className={tone(s.variation)}>{sPct(s.variation)}</dd>
              <dt>Regla</dt><dd>Resultado = variación × {RULES.multiplier}, con pérdida máxima del 100 %</dd>
              <dt>Fecha</dt><dd>{fmtDT(s.createdAt)}</dd>
              <dt>Usuario</dt><dd>{session.user?.name || session.user?.email || '—'}</dd>
            </dl>
          </div>
        </section>
        <section className="panel"><div className="panel-head"><h2>Resultado</h2></div><div className="panel-body"><ResultView r={s} /></div></section>
      </div>
    </>
  );
}
