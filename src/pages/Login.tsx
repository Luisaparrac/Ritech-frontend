import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type User } from '../api';
import { Brand, ErrorBanner, FieldError, Icon, useTitle } from '../components';
import { ROLE_LABEL } from '../util';
import { EMAIL_RE, validarLogin } from '../validaciones';

type Errs = { email?: string; password?: string };

/** Cuentas de demostración: solo rellenan el correo; la contraseña nunca está en el código. */
const DEMO_EMAILS = [
  { role: 'USER', email: 'usuario@ritech.co' },
  { role: 'MANAGER', email: 'gerente@ritech.co' },
];

/** Separa los errores del backend por campo; un 401 sin campo se muestra en la contraseña. */
function backendErrors(err: unknown): { fields: Errs; general: unknown } {
  if (err instanceof ApiError) {
    const fields: Errs = {};
    if (err.fieldErrors.email) fields.email = err.fieldErrors.email;
    if (err.fieldErrors.password) fields.password = err.fieldErrors.password;
    if (!fields.email && !fields.password && err.status === 401) fields.password = err.message;
    if (fields.email || fields.password) return { fields, general: null };
  }
  return { fields: {}, general: err };
}

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  useTitle('Iniciar sesión');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [general, setGeneral] = useState<unknown>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const showErrors = (e: Errs) => {
    setErrs(e);
    (e.email ? emailRef : passRef).current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneral(null);
    // Formato y campos obligatorios antes de consultar al backend.
    const pre = validarLogin(email, password);
    if (!pre.ok) return showErrors(pre.errors);
    setBusy(true);
    try {
      onLogin(await api.login(email.trim().toLowerCase(), password));
    } catch (err) {
      const { fields, general } = backendErrors(err);
      setGeneral(general);
      if (fields.email || fields.password) showErrors(fields); else setErrs({});
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-box">
        <Brand />
        <section className="auth-panel" aria-labelledby="login-title">
          <h1 id="login-title">Iniciar sesión</h1>
          <p className="lead">Accede con tu correo corporativo.</p>
          <ErrorBanner error={general} />
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input ref={emailRef} className="input" id="email" name="email" type="email" autoComplete="username" placeholder="nombre@ritech.co"
                aria-describedby="email-error" aria-invalid={errs.email ? true : undefined}
                value={email} onChange={e => { setEmail(e.target.value); setErrs(x => ({ ...x, email: undefined })); }} />
              <FieldError id="email-error" msg={errs.email} />
            </div>
            <div className="field">
              <div className="field-row">
                <label htmlFor="password">Contraseña</label>
                <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
              </div>
              <div className="input-wrap">
                <input ref={passRef} className="input has-toggle" id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password"
                  aria-describedby="password-error" aria-invalid={errs.password ? true : undefined}
                  value={password} onChange={e => { setPassword(e.target.value); setErrs(x => ({ ...x, password: undefined })); }} />
                <button type="button" className="toggle-pass" aria-controls="password" aria-pressed={show} onClick={() => setShow(s => !s)}>
                  {show ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <FieldError id="password-error" msg={errs.password} />
            </div>
            <button ref={btnRef} className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" />Verificando</> : 'Iniciar sesión'}
            </button>
          </form>
        </section>

        <div className="demo-accounts" aria-label="Cuentas de demostración">
          <p>Cuentas de demostración</p>
          {DEMO_EMAILS.map(a => (
            <div className="demo-row" key={a.email}>
              <span><b>{ROLE_LABEL[a.role]}</b><br /><code>{a.email}</code></span>
              <button type="button" onClick={() => { setEmail(a.email); setErrs({}); setGeneral(null); passRef.current?.focus(); }}>Usar</button>
            </div>
          ))}
        </div>
        <p className="auth-foot">Sistema de apoyo a decisiones de inversión sobre el NASDAQ 100</p>
      </div>
    </main>
  );
}

/** Recuperar contraseña: pantalla separada con confirmación tras enviar. */
export function Recuperar() {
  useTitle('Recuperar contraseña');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string>();
  const [general, setGeneral] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (sent) titleRef.current?.focus(); }, [sent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setGeneral(null);
    const em = email.trim();
    if (!em) { setErr('Ingresa el correo de tu cuenta.'); inputRef.current?.focus(); return; }
    if (!EMAIL_RE.test(em)) { setErr('Escribe un correo válido, por ejemplo nombre@ritech.co.'); inputRef.current?.focus(); return; }
    setBusy(true);
    try {
      await api.recover(em.toLowerCase());
      setSent(em);
    } catch (ex) {
      if (ex instanceof ApiError && ex.fieldErrors.email) { setErr(ex.fieldErrors.email); inputRef.current?.focus(); }
      else setGeneral(ex);
    } finally { setBusy(false); }
  };

  return (
    <main className="auth">
      <div className="auth-box">
        <Brand />
        <section className="auth-panel" aria-labelledby="rec-title">
          {sent ? (
            <>
              <div className="confirm-icon"><Icon name="mail" size={20} /></div>
              <h1 id="rec-title" tabIndex={-1} ref={titleRef}>Revisa tu correo</h1>
              {/* El mensaje no revela si el correo tiene cuenta. */}
              <p className="lead">Si <b>{sent}</b> tiene una cuenta en RiTech, recibirás un enlace para crear una contraseña nueva.</p>
              <Link className="btn btn-primary" to="/login">Volver a iniciar sesión</Link>
            </>
          ) : (
            <>
              <h1 id="rec-title">Recuperar contraseña</h1>
              <p className="lead">Te enviaremos un enlace para crear una contraseña nueva.</p>
              <ErrorBanner error={general} />
              <form onSubmit={submit} noValidate>
                <div className="field">
                  <label htmlFor="rec-email">Correo</label>
                  <input ref={inputRef} className="input" id="rec-email" type="email" autoComplete="username" placeholder="nombre@ritech.co"
                    aria-describedby="rec-email-error" aria-invalid={err ? true : undefined}
                    value={email} onChange={e => { setEmail(e.target.value); setErr(undefined); }} />
                  <FieldError id="rec-email-error" msg={err} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? <><span className="spinner" aria-hidden="true" />Enviando</> : 'Enviar enlace'}
                </button>
              </form>
              <Link className="back-link" to="/login">Volver a iniciar sesión</Link>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
