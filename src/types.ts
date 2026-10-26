// Formas de las respuestas del backend, según /v3/api-docs (Swagger).
export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface AlertSummary { id: number; type: SignalType; reason?: string; time: string }

export interface MarketSummary {
  indexValue?: number; changePercent?: number; changePoints?: number; previousClose?: number;
  marketStatus?: 'OPEN' | 'PRE_MARKET' | 'CLOSED'; lastUpdate?: string; nextCycleAt?: string;
  rsi?: number | null; condition?: string; currentRecommendation?: AlertSummary | null;
  dataStatus?: 'OK' | 'STALE' | 'SOURCE_ERROR' | 'INSUFFICIENT_DATA'; dataStatusMessage?: string;
}

export interface ChartPoint {
  time: string; close: number | null; rsi: number | null; recommendation: SignalType | null;
  volatility?: 'NONE' | 'OPENING' | 'CLOSING' | null; cycleStatus?: string | null;
}

export interface AlertListItem { id: number; type: SignalType; condition?: string; rsi?: number; reason?: string; time: string; volatility?: boolean }

export interface Criterion { criterion: string; observed: string; met: boolean }
export interface AlertDetail {
  id: number; type: SignalType; condition?: string; rsi?: number; emittedAt: string; emittedAtNewYork?: string;
  explanation?: string; volatilityWarning?: string | null; criteria?: Criterion[];
  traceability?: {
    dataUsed?: { marketDataId?: number; indexValue?: number; changePercent?: number; rsi?: number; windowStart?: string; windowEnd?: string };
    period?: string; rule?: string; emission?: string; receivedBy?: string;
  };
  dayChart?: ChartPoint[];
}

export interface Simulation {
  id?: number; capital: number; variation: number; rawPercent?: number; resultPercent: number; resultAmount: number;
  finalValue: number; maxLoss?: number; capped?: boolean; currency?: string; createdAt?: string; saved?: boolean;
  warning?: string | null; recommendationAtSimulation?: AlertSummary | null;
}

export interface CycleHistoryItem {
  time: string; cycleStatus?: string; alertId?: number | null; type?: SignalType | null; rsi?: number | null;
  indexValue?: number | null; condition?: string | null; reason?: string | null;
}

export interface Statistics {
  range?: string; from?: string; to?: string;
  counts?: { buy?: number; sell?: number; hold?: number };
  volatilityWarningPercent?: number;
  cyclesWithoutRecommendation?: { count?: number; cycles?: { time: string; status?: string; reason?: string }[] };
  dataAvailability?: { validCycles?: number; expectedCycles?: number; percent?: number };
  theoreticalPerformance?: {
    strategyReturnPercent?: number; buyAndHoldReturnPercent?: number; differencePercent?: number;
    trades?: { buyTime?: string; buyPrice?: number; sellTime?: string | null; sellPrice?: number | null; returnPercent?: number; open?: boolean }[];
  };
  signalsPerDay?: { date: string; buy?: number; sell?: number; hold?: number }[];
}
