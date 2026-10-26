import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { MarketSummary } from './types';

/** Resumen del mercado compartido por la barra superior y el Panel; se refresca cada 60 s. */
interface MarketState { summary: MarketSummary | null; error: unknown; failedAt: number | null }
const Ctx = createContext<MarketState>({ summary: null, error: null, failedAt: null });

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarketState>({ summary: null, error: null, failedAt: null });
  useEffect(() => {
    let alive = true;
    const load = (silent: boolean) => api.marketSummary(silent)
      .then(d => { if (alive) setState({ summary: d as MarketSummary, error: null, failedAt: null }); })
      // Si falla, se conservan los últimos datos válidos y se marca el error.
      .catch(e => { if (alive) setState(s => ({ ...s, error: e, failedAt: s.failedAt ?? Date.now() })); });
    load(false);
    const id = window.setInterval(() => load(true), 60_000); // actualización cada 60 s
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useMarket = () => useContext(Ctx);

/** Los datos no se están actualizando (falla de conexión o fuente con datos viejos). */
export const isStale = (m: MarketState) =>
  Boolean(m.summary && (m.error || m.summary.dataStatus === 'STALE' || m.summary.dataStatus === 'SOURCE_ERROR'));
