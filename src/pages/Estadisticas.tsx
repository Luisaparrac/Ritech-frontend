import { useState } from 'react';
import { api } from '../api';
import { ErrorBanner, Panel as Box, RangeSeg, SkeletonBlock, SkeletonKpis, useAsync, useTitle, type Range } from '../components';
import type { Statistics } from '../types';
import { DASH, RULES, dmy, fmtT, int, isNum, isoDay, money, pct, r2, sPct, tone } from '../util';

// Solo se muestra lo que entrega /reports/statistics; si falta un dato se muestra "—".
const BASE = 1_000_000;
const grow = (p: unknown) => (isNum(p) ? money(BASE * (1 + Number(p) / 100)) : DASH);
const when = (iso?: string | null) => (iso ? `${dmy(isoDay(iso)).slice(0, 5)} ${fmtT(iso)}` : DASH);

export default function Estadisticas() {
  useTitle('Estadísticas');
  const [range, setRange] = useState<Range>('5d');
  const { data: d, loading, error } = useAsync(() => api.reportStats(range) as Promise<Statistics>, [range]);

  const head = (
    <div className="page-head"><h1>Estadísticas</h1><RangeSeg value={range} onChange={setRange} label="Periodo" /></div>
  );
  if (loading) return <>{head}<SkeletonKpis n={6} /><SkeletonBlock /></>;
  if (error || !d) return <>{head}<ErrorBanner error={error} /></>;

  const c = d.counts ?? {}, cw = d.cyclesWithoutRecommendation, av = d.dataAvailability, tp = d.theoreticalPerformance;
  const perDay = d.signalsPerDay ?? [];
  const trades = tp?.trades ?? [];

  // Barras de señales por día.
  const maxY = Math.max(1, ...perDay.map(x => Math.max(Number(x.buy) || 0, Number(x.sell) || 0)));
  const W = 360, H = 170, bw = 13, gw = (W - 40) / Math.max(perDay.length, 1);

  return (
    <>
      {head}
      <p className="period">Periodo: {d.from ? dmy(d.from) : DASH} a {d.to ? dmy(d.to) : DASH} (hora de Colombia)</p>
      <div className="kpis k6">
        <section className="kpi"><div className="kpi-lab">Señales de COMPRAR</div><div className="kpi-val num up">{int(c.buy)}</div></section>
        <section className="kpi"><div className="kpi-lab">Señales de VENDER</div><div className="kpi-val num down">{int(c.sell)}</div></section>
        <section className="kpi"><div className="kpi-lab">Ciclos en MANTENER</div><div className="kpi-val num">{int(c.hold)}</div></section>
        <section className="kpi"><div className="kpi-lab">Con advertencia de volatilidad</div><div className="kpi-val num">{pct(d.volatilityWarningPercent)}</div>
          <div className="kpi-sub">De las señales emitidas en el periodo</div></section>
        <section className="kpi"><div className="kpi-lab">Ciclos sin recomendación</div><div className="kpi-val num">{int(cw?.count)}</div>
          <div className="kpi-sub">Por falla de la fuente o datos insuficientes</div></section>
        <section className="kpi"><div className="kpi-lab">Disponibilidad de datos</div><div className="kpi-val num">{pct(av?.percent)}</div>
          <div className="kpi-sub">{isNum(av?.validCycles) && isNum(av?.expectedCycles) ? `${av!.validCycles} de ${av!.expectedCycles} ciclos con datos válidos` : 'Ciclos con datos válidos a tiempo'}</div></section>
      </div>

      <div className="dash">
        <Box title="Rendimiento teórico de seguir las señales" right={<span>Regla ×{RULES.multiplier}</span>}>
          <div className="panel-body">
            <p className="muted small">Se compra con la primera señal de COMPRAR y se vende con la siguiente de VENDER. No incluye comisiones ni costos, y no corresponde a inversiones reales de RiTech ni de sus usuarios.</p>
            <div className="bt">
              <div><div className="kpi-lab">Siguiendo las señales</div><div className={`kpi-val num ${tone(tp?.strategyReturnPercent)}`}>{sPct(tp?.strategyReturnPercent)}</div>
                <div className="kpi-sub num">{money(BASE)} se convierten en {grow(tp?.strategyReturnPercent)}</div></div>
              <div><div className="kpi-lab">Manteniendo todo el periodo</div><div className={`kpi-val num ${tone(tp?.buyAndHoldReturnPercent)}`}>{sPct(tp?.buyAndHoldReturnPercent)}</div>
                <div className="kpi-sub num">{money(BASE)} se convierten en {grow(tp?.buyAndHoldReturnPercent)}</div></div>
            </div>
            {isNum(tp?.differencePercent) && <p className="kpi-sub num">Diferencia entre ambas estrategias: <span className={tone(tp!.differencePercent)}>{sPct(tp!.differencePercent)}</span></p>}
            <div className="tbl-wrap flat">
              <table className="tbl">
                <thead><tr><th>Entrada (COMPRAR)</th><th>Salida (VENDER)</th><th className="r">Índice</th><th className="r">Resultado</th></tr></thead>
                <tbody>
                  {trades.map((t, i) => {
                    const idx = isNum(t.buyPrice) && isNum(t.sellPrice) && Number(t.buyPrice) ? (Number(t.sellPrice) / Number(t.buyPrice) - 1) * 100 : null;
                    return (
                      <tr className="nolink" key={i}>
                        <td className="num">{when(t.buyTime)} <span className="muted">{r2(t.buyPrice)}</span></td>
                        <td className="num">{t.open ? <span className="muted">Abierta, valorada al último cierre</span> : <>{when(t.sellTime)} <span className="muted">{r2(t.sellPrice)}</span></>}</td>
                        <td className={`r num ${tone(idx)}`}>{sPct(idx)}</td>
                        <td className={`r num ${tone(t.returnPercent)}`}>{sPct(t.returnPercent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!trades.length && <div className="empty"><b>Sin operaciones en el periodo</b>No hubo una señal de COMPRAR seguida de una de VENDER.</div>}
            </div>
          </div>
        </Box>
        <Box title="Señales por día">
          <div className="panel-body">
            {perDay.length ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="bars" role="img" aria-label="Señales de COMPRAR y VENDER por día">
                <g fontSize="11" fill="var(--muted)">
                  <line x1="20" x2={W} y1={H - 24} y2={H - 24} stroke="var(--line-strong)" />
                  {perDay.map((x, i) => {
                    const b = Number(x.buy) || 0, s = Number(x.sell) || 0;
                    const cx = 30 + gw * i + gw / 2, hb = (H - 40) * b / maxY, hs = (H - 40) * s / maxY;
                    return (
                      <g key={x.date}>
                        <rect x={cx - bw - 2} y={H - 24 - hb} width={bw} height={hb} fill="var(--up)" opacity=".85"><title>{dmy(x.date)}: {b} COMPRAR</title></rect>
                        <rect x={cx + 2} y={H - 24 - hs} width={bw} height={hs} fill="var(--down)" opacity=".85"><title>{dmy(x.date)}: {s} VENDER</title></rect>
                        <text x={cx - bw / 2 - 2} y={H - 28 - hb} textAnchor="middle">{b || ''}</text>
                        <text x={cx + bw / 2 + 2} y={H - 28 - hs} textAnchor="middle">{s || ''}</text>
                        <text x={cx} y={H - 8} textAnchor="middle">{dmy(x.date).slice(0, 5)}</text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            ) : <p className="muted small">El servidor no envió señales por día para este periodo.</p>}
            <div className="chart-legend"><span><i className="lg" style={{ background: 'var(--up)' }} />COMPRAR</span><span><i className="lg" style={{ background: 'var(--down)' }} />VENDER</span></div>
            <h3 className="sub-h">Ciclos sin recomendación</h3>
            {cw?.cycles?.length
              ? <ul className="log">{cw.cycles.map((e, i) => <li key={i}><span className="num">{when(e.time)}</span><span className="t-warn">{e.reason || e.status || DASH}</span></li>)}</ul>
              : <p className="muted small">Ninguna falla de la fuente en el periodo.</p>}
          </div>
        </Box>
      </div>
    </>
  );
}
