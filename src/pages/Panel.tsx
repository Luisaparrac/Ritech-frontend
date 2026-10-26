import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBanner, Gauge, Icon, IndexChart, Panel as Box, RangeSeg, Sig, SkeletonBlock, SkeletonKpis, useAsync, useTitle, type Range } from '../components';
import { isStale, useMarket } from '../market';
import type { AlertListItem, ChartPoint } from '../types';
import { capitalize, dmy, fmtT, isNum, isoDay, plainCond, r2, sPct, shortReason, sign } from '../util';

export default function Panel() {
  useTitle('Panel');
  const m = useMarket(); const s = m.summary;
  const [range, setRange] = useState<Range>('1d');
  const hist = useAsync(() => api.marketHistory(range) as Promise<ChartPoint[]>, [range]);
  const alerts = useAsync(() => api.alerts({ types: 'BUY,SELL' }) as Promise<AlertListItem[]>, []);

  if (!s) {
    return (
      <>
        <div className="page-head"><h1>Panel</h1><p>Cargando datos de la fuente</p></div>
        {m.error ? <ErrorBanner error={m.error} /> : <><SkeletonKpis /><SkeletonBlock /></>}
      </>
    );
  }

  const st = s.marketStatus;
  const stale = isStale(m);
  const today = isoDay(s.lastUpdate);
  const upd = `${dmy(today)} ${fmtT(s.lastUpdate)}`;
  const staleTag = stale ? <span className="stale"><Icon name="alert" size={12} />Sin actualizar desde las {fmtT(s.lastUpdate)}</span> : null;
  const insufficient = s.dataStatus === 'INSUFFICIENT_DATA' || !isNum(s.rsi);
  const rec = s.currentRecommendation;
  const recent = [...(alerts.data ?? [])].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

  let recCard;
  if (st === 'CLOSED') recCard = <><div className="kpi-note">El mercado está cerrado; no se emiten recomendaciones nuevas.</div>
    {rec && <div className="kpi-sub">Última: <Sig type={rec.type} /> a las {fmtT(rec.time)}</div>}</>;
  else if (st === 'PRE_MARKET') recCard = <div className="kpi-note">Preapertura: el sistema no emite recomendaciones hasta la apertura del mercado.</div>;
  else if (stale) recCard = <div className="kpi-note warn">Sin recomendación nueva: no hay datos válidos desde las {fmtT(s.lastUpdate)}. El sistema no recomienda con datos inválidos.</div>;
  else if (!rec) recCard = <div className="kpi-note">{s.dataStatus === 'INSUFFICIENT_DATA' && s.dataStatusMessage ? s.dataStatusMessage : 'Aún no hay una recomendación emitida.'}</div>;
  else recCard = <>
    <div className="kpi-val"><Sig type={rec.type} lg /></div>
    <div className="kpi-sub">{rec.time === s.lastUpdate ? `${shortReason(s.rsi, s.condition)} a las ${fmtT(rec.time)}` : `Emitida el ${dmy(isoDay(rec.time))} a las ${fmtT(rec.time)}`}</div>
    <Link className="kpi-link" to={`/alertas/${rec.id}`}>Ver por qué</Link>
  </>;

  const banner = m.error
    ? <div className="banner warn" role="alert"><Icon name="alert" size={16} /><div><b>Sin conexión con el servidor.</b> Las cifras son del {dmy(today)} a las {fmtT(s.lastUpdate)} y no se están actualizando. Se reintentará en 60 segundos.</div></div>
    : stale ? <div className="banner warn"><Icon name="alert" size={16} /><div><b>Sin conexión con la fuente de datos.</b> {s.dataStatusMessage || `Las cifras son del ${dmy(today)} a las ${fmtT(s.lastUpdate)} y no se están actualizando.`}</div></div>
    : st === 'CLOSED' ? <div className="banner info"><Icon name="clock" size={16} /><div><b>Mercado cerrado.</b> Se muestran los datos del último ciclo, {dmy(today)} a las {fmtT(s.lastUpdate)}.</div></div>
    : st === 'PRE_MARKET' ? <div className="banner info"><Icon name="clock" size={16} /><div><b>Preapertura.</b> Las cifras corresponden al cierre anterior.</div></div>
    : null;

  return (
    <>
      <div className="page-head"><h1>Panel</h1><p>Datos al {dmy(today)}, {fmtT(s.lastUpdate)} (hora de Colombia)</p></div>
      {banner}
      <div className="kpis">
        <section className="kpi" aria-label="Valor del NASDAQ 100">
          <div className="kpi-lab">NASDAQ 100 {staleTag}</div>
          <div className="kpi-val num">{r2(s.indexValue)}</div>
          <div className="kpi-sub num">
            <span className={Number(s.changePercent) >= 0 ? 'up' : 'down'}>
              {sPct(s.changePercent)}{isNum(s.changePoints) && ` (${sign(Number(s.changePoints)) || '+'}${r2(Math.abs(Number(s.changePoints)))})`}
            </span> frente al cierre anterior
          </div>
        </section>
        <section className="kpi" aria-label="Estado del mercado">
          <div className="kpi-lab">Estado del mercado</div>
          <div className="kpi-val mk">
            {st === 'CLOSED' ? <><span className="dot closed" />Cerrado</> : st === 'PRE_MARKET' ? <><span className="dot pre" />Preapertura</> : <><span className="dot" />Abierto</>}
          </div>
          <div className="kpi-sub">Última actualización: {upd}</div>
          {st === 'OPEN' && !stale && s.nextCycleAt && <div className="kpi-sub">Próximo ciclo: {fmtT(s.nextCycleAt)}</div>}
        </section>
        <section className="kpi" aria-label="RSI">
          <div className="kpi-lab">RSI (14) {insufficient ? null : staleTag}</div>
          {insufficient
            ? <><div className="kpi-val muted">Sin calcular</div><div className="kpi-sub">{s.dataStatusMessage || 'Datos insuficientes para calcular el RSI.'}</div></>
            : <><div className="kpi-val num">{r2(s.rsi)}</div><div className="kpi-sub">{capitalize(plainCond(s.condition))}</div><Gauge value={Number(s.rsi)} /></>}
        </section>
        <section className="kpi" aria-label="Recomendación vigente">
          <div className="kpi-lab">Recomendación vigente</div>
          {recCard}
        </section>
      </div>

      <div className="dash">
        <Box title="NASDAQ 100 y RSI" right={<RangeSeg value={range} onChange={setRange} />}>
          <div className="panel-body">
            {hist.loading ? <div className="sk-block" aria-busy="true" aria-label="Cargando gráfico" style={{ marginTop: 0 }} />
              : hist.error ? <ErrorBanner error={hist.error} />
              : <IndexChart points={hist.data ?? []} range={range} />}
          </div>
        </Box>
        <Box title="Alertas recientes" right={<Link to="/alertas">Ver todas</Link>}>
          <div className="recent">
            {alerts.loading ? [0, 1, 2].map(i => <div className="rrow" key={i}><span className="sk sk-w80" /><span className="sk sk-w50" /><span className="sk sk-w110" /></div>)
              : alerts.error ? <div className="panel-body"><ErrorBanner error={alerts.error} /></div>
              : recent.length ? recent.map(a => (
                <Link className="rrow" to={`/alertas/${a.id}`} key={a.id}>
                  <Sig type={a.type} />
                  <span className="rr-t num">{isoDay(a.time) === today ? fmtT(a.time) : `${dmy(isoDay(a.time)).slice(0, 5)} ${fmtT(a.time)}`}</span>
                  <span className="rr-r">{shortReason(a.rsi, a.condition)}{a.volatility && <span className="a-vol"><Icon name="alert" size={12} />Alta volatilidad</span>}</span>
                </Link>))
              : <div className="empty"><b>Sin alertas recientes</b>Las señales de COMPRAR y VENDER aparecerán aquí.</div>}
          </div>
          <div className="p-foot">No se emite recomendación con datos incompletos, retrasados o inválidos.</div>
        </Box>
      </div>
    </>
  );
}
