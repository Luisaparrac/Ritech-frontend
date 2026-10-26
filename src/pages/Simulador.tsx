import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ErrorBanner, FieldError, Icon, ResultView, useTitle } from '../components';
import { useMarket } from '../market';
import type { Simulation } from '../types';
import { CURRENCIES, DEFAULT_CURRENCY, RULES, fmtDT, isNum, r2, sPct, simNo } from '../util';
import { MSG, camposVacios, parseCapital, parseVariation, validarSimulacion, type SimField } from '../validaciones';

// El backend no recibe moneda en POST /simulations (Swagger: SimulationRequest = {capital, variation}),
// así que la moneda queda fija en COP.
const CURRENCY = CURRENCIES[DEFAULT_CURRENCY];
const fmtCapInput = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
const rangeHint = `Entre ${sPct(RULES.varMin).replace(',00', '')} y ${sPct(RULES.varMax).replace(',00', '')}, con máximo dos decimales. Usa el signo − para una caída.`;

export default function Simulador() {
  useTitle('Simulador');
  const market = useMarket().summary;
  const [values, setValues] = useState<Record<SimField, string>>({ capital: '', variation: '' });
  const [errors, setErrors] = useState<Partial<Record<SimField, string>>>({});
  const [general, setGeneral] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Simulation | null>(null);
  const refs = { capital: useRef<HTMLInputElement>(null), variation: useRef<HTMLInputElement>(null) };

  useEffect(() => { refs.capital.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = camposVacios(values).length > 0;
  const setErr = (k: SimField, msg?: string) => setErrors(e => ({ ...e, [k]: msg }));
  const focus = (k: SimField) => refs[k].current?.focus();

  // Impide letras en el capital y avisa; el error desaparece al escribir un valor válido.
  const onCapital = (raw: string) => {
    const clean = raw.replace(/[^\d.,]/g, '');
    if (clean !== raw) setErr('capital', /[-−]/.test(raw) ? MSG.capitalPositive : 'Solo se permiten números y los separadores punto o coma.');
    else setErr('capital');
    setValues(v => ({ ...v, capital: clean }));
  };
  const onVariation = (raw: string) => {
    const norm = raw.replace(/−/g, '-');
    const clean = norm.replace(/[^\d.,+\-%\s]/g, '');
    if (clean !== norm) setErr('variation', 'Solo se permiten números, el signo + o − y el símbolo %.');
    else setErr('variation');
    setValues(v => ({ ...v, variation: clean }));
  };
  const blurCapital = () => {
    if (!values.capital.trim()) return;
    const r = parseCapital(values.capital);
    if (r.ok) setValues(v => ({ ...v, capital: fmtCapInput(r.value) }));
    setErr('capital', r.ok ? undefined : r.error);
  };
  const blurVariation = () => {
    if (!values.variation.trim()) return;
    const r = parseVariation(values.variation);
    setErr('variation', r.ok ? undefined : r.error);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); // Enter no recarga la página
    if (busy) return;
    setGeneral(null);
    const missing = camposVacios(values);
    if (missing.length) { // indica qué falta y lleva el foco al primero
      setErrors(Object.fromEntries(missing.map(k => [k, MSG.required])));
      focus(missing[0]);
      return;
    }
    const v = validarSimulacion(values); // todos los errores a la vez
    setErrors(v.errors);
    if (!v.ok || !v.values) { focus(v.firstInvalid!); return; }
    setBusy(true);
    try {
      setRes(await api.simulate(v.values.capital, v.values.variation) as Simulation);
    } catch (err) {
      if (err instanceof ApiError && (err.fieldErrors.capital || err.fieldErrors.variation)) {
        const fe = { capital: err.fieldErrors.capital, variation: err.fieldErrors.variation };
        setErrors(fe); focus(fe.capital ? 'capital' : 'variation');
      } else setGeneral(err);
    } finally { setBusy(false); }
  };

  const useCurrent = () => {
    if (!market || !isNum(market.changePercent)) return;
    const c = Number(market.changePercent);
    setValues(v => ({ ...v, variation: (c > 0 ? '+' : '') + r2(c) }));
    setErr('variation'); focus('variation');
  };

  return (
    <>
      <div className="page-head">
        <h1>Simulador</h1>
        <p>Cifras en {CURRENCY.name} ({CURRENCY.code})</p>
      </div>
      <div className="sim">
        <section className="panel" aria-labelledby="sim-form-title">
          <div className="panel-head"><h2 id="sim-form-title">Datos de la simulación</h2><span>Regla ×{RULES.multiplier}</span></div>
          <form className="panel-body" onSubmit={submit} noValidate>
            <div className="field">
              <span className="flabel" id="cur-label">Moneda</span>
              <div className="seg" role="radiogroup" aria-labelledby="cur-label">
                <button type="button" role="radio" aria-checked="true">{CURRENCY.code}</button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="capital">Capital a invertir <span className="req">(obligatorio)</span></label>
              <div className="affix">
                <span className="pre">{CURRENCY.symbol}</span>
                <input ref={refs.capital} className="input p-pre p-suf" id="capital" inputMode="decimal" autoComplete="off" placeholder="1.000.000"
                  aria-describedby="capital-error capital-hint" aria-required="true" aria-invalid={errors.capital ? true : undefined}
                  value={values.capital} onChange={e => onCapital(e.target.value)} onBlur={blurCapital} />
                <span className="suf">{CURRENCY.code}</span>
              </div>
              <FieldError id="capital-error" msg={errors.capital} />
              <div className="hint" id="capital-hint">Monto mayor que cero, con máximo dos decimales.</div>
            </div>
            <div className="field">
              <label htmlFor="variation">Variación esperada del NASDAQ 100 <span className="req">(obligatorio)</span></label>
              <div className="affix">
                <input ref={refs.variation} className="input p-suf" id="variation" inputMode="decimal" autoComplete="off" placeholder="2,00"
                  aria-describedby="variation-error variation-hint" aria-required="true" aria-invalid={errors.variation ? true : undefined}
                  value={values.variation} onChange={e => onVariation(e.target.value)} onBlur={blurVariation} />
                <span className="suf">%</span>
              </div>
              <FieldError id="variation-error" msg={errors.variation} />
              <div className="hint" id="variation-hint">{rangeHint}</div>
              {market && isNum(market.changePercent) && (
                <button type="button" className="use-current" onClick={useCurrent}><Icon name="line" size={14} />Usar variación actual ({sPct(market.changePercent)})</button>
              )}
            </div>
            <ErrorBanner error={general} />
            <button className="btn btn-primary" type="submit" aria-disabled={empty || busy}>
              {busy ? <><span className="spinner" aria-hidden="true" />Simulando</> : 'Simular'}
            </button>
            <p className="disabled-note" hidden={!empty}>Completa los dos campos para simular.</p>
          </form>
        </section>

        <section className="panel" aria-labelledby="sim-res-title" aria-live="polite">
          <div className="panel-head">
            <h2 id="sim-res-title">Resultado</h2>
            <span>{res ? (res.saved !== false && res.id != null ? `Simulación N.º ${simNo(res.id)}` : 'Sin guardar') : ''}</span>
          </div>
          <div className="panel-body">
            {!res ? <div className="result-empty"><b>Aún no hay resultado</b>Ingresa el capital y la variación esperada, luego pulsa Simular.</div> : (
              <>
                <ResultView r={res} />
                {res.saved !== false && res.id != null
                  ? <div className="saved"><span>Guardado en Mi historial{res.createdAt ? ` el ${fmtDT(res.createdAt)}` : ''}</span><Link to={`/mi-historial/${res.id}`}>Ver en mi historial</Link></div>
                  : <div className="note cap" role="alert"><Icon name="alert" size={16} /><div><b>No se pudo guardar la simulación.</b> El resultado sigue disponible en pantalla; vuelve a simular cuando se restablezca la conexión.</div></div>}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
