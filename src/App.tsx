import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, session, type Role, type User } from './api';
import { Brand, GlobalLoader, Icon, type IconName } from './components';
import { MarketProvider, isStale, useMarket } from './market';
import { ROLE_LABEL, dmy, fmtT, isoDay, r2, sPct } from './util';
import Login, { Recuperar } from './pages/Login';
import Panel from './pages/Panel';
import Alertas from './pages/Alertas';
import Simulador from './pages/Simulador';
import Historial from './pages/Historial';
import Historicos from './pages/Historicos';
import Estadisticas from './pages/Estadisticas';

const MENU: Record<Role, { to: string; label: string; icon: IconName }[]> = {
  USER: [
    { to: '/panel', label: 'Panel', icon: 'grid' }, { to: '/alertas', label: 'Alertas', icon: 'bell' },
    { to: '/simulador', label: 'Simulador', icon: 'calc' }, { to: '/mi-historial', label: 'Mi historial', icon: 'clock' },
  ],
  MANAGER: [
    { to: '/panel', label: 'Panel', icon: 'grid' }, { to: '/alertas', label: 'Alertas', icon: 'bell' },
    { to: '/historicos', label: 'Históricos', icon: 'line' }, { to: '/estadisticas', label: 'Estadísticas', icon: 'bars' },
  ],
};

/** Resumen del índice en la barra superior. */
function Ticker() {
  const m = useMarket(); const s = m.summary;
  if (!s && !m.error) {
    return <><span className="sym">NASDAQ 100</span><span className="sk sk-w80" /><span className="sk sk-w50" /><span className="sk sk-w110" /></>;
  }
  if (!s) {
    return <><span className="sym">NASDAQ 100</span><span className="conn-warn" role="status"><Icon name="alert" size={14} />Sin conexión con el servidor</span></>;
  }
  const st = s.marketStatus;
  const mk = st === 'CLOSED' ? <span className="mkt"><span className="dot closed" />Mercado cerrado</span>
    : st === 'PRE_MARKET' ? <span className="mkt"><span className="dot pre" />Preapertura</span>
    : <span className="mkt"><span className="dot" />Mercado abierto</span>;
  const updated = `${dmy(isoDay(s.lastUpdate))} ${fmtT(s.lastUpdate)}`;
  const warn = m.error ? `Sin conexión con el servidor. Último dato válido: ${fmtT(s.lastUpdate)}`
    : isStale(m) ? (s.dataStatusMessage || `Sin conexión con la fuente. Último dato válido: ${fmtT(s.lastUpdate)}`) : '';
  return (
    <>
      <span className="sym">NASDAQ 100</span>
      <span className="px num">{r2(s.indexValue)}</span>
      <span className={`num ${Number(s.changePercent) >= 0 ? 'up' : 'down'}`}>{sPct(s.changePercent)}</span>
      {mk}
      {warn ? <span className="conn-warn" role="status"><Icon name="alert" size={14} />{warn}</span>
        : <span className="mkt upd num">Actualizado {updated}</span>}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(session.user && session.token ? session.user : null);
  const nav = useNavigate();

  useEffect(() => {
    const h = () => { setUser(null); nav('/login', { replace: true }); };
    window.addEventListener('ritech:unauthorized', h);
    return () => window.removeEventListener('ritech:unauthorized', h);
  }, [nav]);

  const logout = async () => { await api.logout(); setUser(null); nav('/login', { replace: true }); };

  if (!user) {
    return (
      <>
        <GlobalLoader />
        <Routes>
          <Route path="/login" element={<Login onLogin={u => { setUser(u); nav('/panel', { replace: true }); }} />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  const isUser = user.role === 'USER';
  // Una ruta de otro rol no existe para quien no la tiene: redirige al Panel.
  const guard = (ok: boolean, el: JSX.Element) => ok ? el : <Navigate to="/panel" replace />;

  return (
    <MarketProvider>
      <GlobalLoader />
      <div className="app">
        <header className="topbar">
          <Brand />
          <div className="ticker" aria-label="Resumen del índice"><Ticker /></div>
          <div className="topbar-right">
            <div className="who"><b>{user.name || user.email}</b><span>{ROLE_LABEL[user.role] ?? user.role}</span></div>
            <button className="btn btn-ghost" onClick={logout}><Icon name="out" size={16} />Cerrar sesión</button>
          </div>
        </header>

        <nav className="sidebar" aria-label="Navegación principal">
          <ul className="nav">
            {(MENU[user.role] ?? MENU.USER).map(m => (
              <li key={m.to}><NavLink to={m.to}><Icon name={m.icon} />{m.label}</NavLink></li>
            ))}
          </ul>
        </nav>

        <main className="main" id="main" tabIndex={-1}>
          <Routes>
            <Route path="/panel" element={<Panel />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/alertas/:id" element={<Alertas />} />
            <Route path="/simulador" element={guard(isUser, <Simulador />)} />
            <Route path="/mi-historial" element={guard(isUser, <Historial />)} />
            <Route path="/mi-historial/:id" element={guard(isUser, <Historial />)} />
            <Route path="/historicos" element={guard(!isUser, <Historicos />)} />
            <Route path="/estadisticas" element={guard(!isUser, <Estadisticas />)} />
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Routes>
        </main>
      </div>
    </MarketProvider>
  );
}
