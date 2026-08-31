import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import hotelExteriorUrl from './assets/hotel-exterior.webp';
import { CafeDashboard } from './CafeDashboard';
import { CafeWorkspace, CatalogWorkspace } from './CafeWorkspace';
import { OperationalDashboard } from './OperationalDashboard';
import { ReceptionistWorkspace } from './ReceptionistWorkspace';
import { SuperadminWorkspace } from './SuperadminWorkspace';
import {
  DEFAULT_LANGUAGE,
  catalogUnitCopy,
  getCatalogCopy,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  operationalCopy,
  translations,
  type AuthCopy,
  type CatalogUnit,
  type Language,
  type OperationalRole,
} from './i18n';

type Screen =
  | 'login'
  | 'forgot'
  | 'admin-users'
  | 'admin-roles'
  | 'cafe-orders'
  | 'cafe-menu'
  | 'receptionist-rooms'
  | 'spa-requests'
  | 'spa-menu'
  | 'restaurant-requests'
  | 'restaurant-menu'
  | 'lounge-requests'
  | 'lounge-menu'
  | 'beauty-and-salon-requests'
  | 'beauty-and-salon-menu'
  | 'housekeeping-requests'
  | 'room-manager-requests';
type FormStatus = 'idle' | 'submitting' | 'error' | 'success';

interface StaffUser {
  id: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function screenFromPath(pathname: string): Screen {
  if (pathname.endsWith('/forgot-password')) return 'forgot';
  if (pathname.includes('/admin/roles')) return 'admin-roles';
  if (pathname.includes('/admin/users')) return 'admin-users';
  if (pathname.includes('/cafe/orders')) return 'cafe-orders';
  if (pathname.includes('/cafe/menu')) return 'cafe-menu';
  if (pathname.includes('/receptionist/rooms')) return 'receptionist-rooms';
  if (pathname.includes('/spa/menu')) return 'spa-menu';
  if (pathname.includes('/spa/requests')) return 'spa-requests';
  if (pathname.includes('/restaurant/menu')) return 'restaurant-menu';
  if (pathname.includes('/restaurant/requests')) return 'restaurant-requests';
  if (pathname.includes('/lounge/menu')) return 'lounge-menu';
  if (pathname.includes('/lounge/requests')) return 'lounge-requests';
  if (pathname.includes('/beauty-and-salon/menu')) return 'beauty-and-salon-menu';
  if (pathname.includes('/beauty-and-salon/requests')) return 'beauty-and-salon-requests';
  if (pathname.includes('/housekeeping/requests')) return 'housekeeping-requests';
  if (pathname.includes('/room-manager/requests')) return 'room-manager-requests';
  return 'login';
}

function screenForOperationalRole(role: OperationalRole): Screen {
  const screens: Record<OperationalRole, Screen> = {
    SPA: 'spa-requests',
    RESTAURANT: 'restaurant-requests',
    LOUNGE: 'lounge-requests',
    BEAUTY_AND_SALON: 'beauty-and-salon-requests',
    HOUSEKEEPING: 'housekeeping-requests',
    ROOM_MANAGER: 'room-manager-requests',
  };
  return screens[role];
}

function screenForCatalogRole(role: OperationalRole): Screen | null {
  const screens: Partial<Record<OperationalRole, Screen>> = {
    SPA: 'spa-menu',
    RESTAURANT: 'restaurant-menu',
    LOUNGE: 'lounge-menu',
    BEAUTY_AND_SALON: 'beauty-and-salon-menu',
  };
  return screens[role] ?? null;
}

function catalogUnitForRole(
  role: OperationalRole,
): 'SPA' | 'RESTAURANT' | 'LOUNGE' | 'BEAUTY_AND_SALON' | null {
  const units: Partial<
    Record<OperationalRole, 'SPA' | 'RESTAURANT' | 'LOUNGE' | 'BEAUTY_AND_SALON'>
  > = {
    SPA: 'SPA',
    RESTAURANT: 'RESTAURANT',
    LOUNGE: 'LOUNGE',
    BEAUTY_AND_SALON: 'BEAUTY_AND_SALON',
  };
  return units[role] ?? null;
}

function operationalRoleForUser(user: StaffUser): OperationalRole | null {
  if (user.roles.includes('ROOM_MANAGER')) return 'ROOM_MANAGER';
  if (user.roles.includes('SPA')) return 'SPA';
  if (user.roles.includes('RESTAURANT')) return 'RESTAURANT';
  if (user.roles.includes('LOUNGE')) return 'LOUNGE';
  if (user.roles.includes('BEAUTY_AND_SALON')) return 'BEAUTY_AND_SALON';
  if (user.roles.includes('HOUSEKEEPING')) return 'HOUSEKEEPING';
  return null;
}

function landingScreenForUser(user: StaffUser): Screen {
  if (user.roles.includes('SUPERADMIN')) return 'admin-users';
  if (user.roles.includes('CAFE')) return 'cafe-orders';
  if (user.roles.includes('RECEPTIONIST')) return 'receptionist-rooms';
  const operationalRole = operationalRoleForUser(user);
  return operationalRole === null ? 'login' : screenForOperationalRole(operationalRole);
}

function canUserStayOnScreen(user: StaffUser, screen: Screen): boolean {
  if (user.roles.includes('SUPERADMIN')) {
    return screen === 'admin-users' || screen === 'admin-roles';
  }
  if (user.roles.includes('CAFE')) {
    return screen === 'cafe-orders' || screen === 'cafe-menu';
  }
  if (user.roles.includes('RECEPTIONIST')) return screen === 'receptionist-rooms';
  const operationalRole = operationalRoleForUser(user);
  if (operationalRole === null) return false;
  if (screen === screenForOperationalRole(operationalRole)) return true;
  const catalogScreen = screenForCatalogRole(operationalRole);
  return user.permissions.includes('menu:manage') && screen === catalogScreen;
}

function pathForScreen(nextScreen: Screen): string {
  return nextScreen === 'forgot'
    ? '/forgot-password'
    : nextScreen === 'admin-roles'
      ? '/admin/roles'
      : nextScreen === 'admin-users'
        ? '/admin/users'
        : nextScreen === 'cafe-orders'
          ? '/cafe/orders'
          : nextScreen === 'cafe-menu'
            ? '/cafe/menu'
            : nextScreen === 'receptionist-rooms'
              ? '/receptionist/rooms'
              : nextScreen === 'spa-requests'
                ? '/spa/requests'
                : nextScreen === 'spa-menu'
                  ? '/spa/menu'
                  : nextScreen === 'restaurant-requests'
                    ? '/restaurant/requests'
                    : nextScreen === 'restaurant-menu'
                      ? '/restaurant/menu'
                      : nextScreen === 'lounge-requests'
                        ? '/lounge/requests'
                        : nextScreen === 'lounge-menu'
                          ? '/lounge/menu'
                          : nextScreen === 'beauty-and-salon-requests'
                            ? '/beauty-and-salon/requests'
                            : nextScreen === 'beauty-and-salon-menu'
                              ? '/beauty-and-salon/menu'
                              : nextScreen === 'housekeeping-requests'
                                ? '/housekeeping/requests'
                                : nextScreen === 'room-manager-requests'
                                  ? '/room-manager/requests'
                                  : '/';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <path
        d="M16 10H5M9.5 5.5 5 10l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 3.5 17 16.5M8.3 8.4a2.4 2.4 0 0 0 3.3 3.3M5.2 5.7C3.8 6.9 3 8.4 3 10c1.6 3.1 4 4.7 7 4.7 1.3 0 2.5-.3 3.5-.9M6.7 4.5c1-.5 2.1-.8 3.3-.8 3 0 5.4 1.6 7 4.7-.4.8-.9 1.5-1.5 2.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 10c1.6-3.1 4-4.7 7-4.7s5.4 1.6 7 4.7c-1.6 3.1-4 4.7-7 4.7S4.6 13.1 3 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <rect
        x="4.1"
        y="8.2"
        width="11.8"
        height="8.3"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.6 8.2V6.5a3.4 3.4 0 1 1 6.8 0v1.7M10 11.4v2.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m4.5 10.2 3.5 3.4 7.5-7.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 6.3v4.2M10 13.3v.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-mark__star">✦</span>
      <span className="brand-mark__arch">H</span>
    </div>
  );
}

function BrandPanel({ copy }: { copy: AuthCopy }) {
  return (
    <aside className="brand-panel">
      <div className="brand-panel__image" style={{ backgroundImage: `url(${hotelExteriorUrl})` }} />
      <div className="brand-panel__veil" />
      <div className="brand-panel__content">
        <div className="brand-lockup brand-lockup--light">
          <BrandMark />
          <div>
            <p className="brand-lockup__name">Hadith Hotel</p>
            <p className="brand-lockup__descriptor">Complex of Imam Al-Bukhari</p>
          </div>
        </div>

        <div className="brand-panel__message">
          <p className="eyebrow eyebrow--light">{copy.brandWorkspace}</p>
          <h1>{copy.brandHeadline}</h1>
          <p>{copy.brandSubcopy}</p>
        </div>

        <div className="brand-panel__footer">
          <span>Hadith Hotel</span>
          <span className="brand-panel__footer-line" />
          <span>{copy.brandFooterLabel}</span>
        </div>
      </div>
    </aside>
  );
}

function BrandHeader({ copy }: { copy: AuthCopy }) {
  return (
    <div className="brand-lockup brand-lockup--dark">
      <BrandMark />
      <div>
        <p className="brand-lockup__name">Hadith Hotel</p>
        <p className="brand-lockup__descriptor">{copy.staffWorkspace}</p>
      </div>
    </div>
  );
}

function LanguageSwitcher({
  copy,
  language,
  onChange,
}: {
  copy: AuthCopy;
  language: Language;
  onChange: (nextLanguage: Language) => void;
}) {
  return (
    <nav aria-label={copy.languageLabel} className="language-switcher">
      <span className="language-switcher__label">{copy.languageLabel}</span>
      <div className="language-switcher__options">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            aria-pressed={language === option.code}
            className={
              language === option.code
                ? 'language-option language-option--active'
                : 'language-option'
            }
            key={option.code}
            onClick={() => onChange(option.code)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function getErrorMessage(error: unknown, copy: AuthCopy): string {
  if (error instanceof TypeError) {
    return copy.serviceUnavailable;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return copy.genericError;
}

function readApiError(response: Response, copy: AuthCopy): string {
  if (response.status === 401) {
    return copy.invalidCredentials;
  }

  return copy.genericError;
}

function LoginScreen({
  copy,
  onForgot,
  onSuccess,
}: {
  copy: AuthCopy;
  onForgot: () => void;
  onSuccess: (user: StaffUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (normalizedEmail.length === 0 || password.length === 0) {
      setStatus('error');
      setErrorMessage(copy.missingCredentials);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setStatus('error');
      setErrorMessage(copy.invalidEmail);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/staff/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        throw new Error(readApiError(response, copy));
      }

      const body = (await response.json()) as { user: StaffUser };
      onSuccess(body.user);
    } catch (error) {
      setStatus('error');
      setErrorMessage(getErrorMessage(error, copy));
    }
  }

  return (
    <section className="auth-content" aria-labelledby="login-title">
      <div className="mobile-brand-header">
        <BrandHeader copy={copy} />
      </div>

      <div className="auth-heading">
        <p className="eyebrow">{copy.staffAccess}</p>
        <h2 id="login-title">{copy.welcomeBack}</h2>
        <p>{copy.loginDescription}</p>
      </div>

      <div className="section-divider" />

      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="field-group">
          <label htmlFor="staff-email">{copy.email}</label>
          <input
            autoComplete="email"
            id="staff-email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={copy.emailPlaceholder}
            spellCheck="false"
            type="email"
            value={email}
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="staff-password">{copy.password}</label>
            <button className="text-button" onClick={onForgot} type="button">
              {copy.forgotPassword}
            </button>
          </div>
          <div className="password-field">
            <input
              autoComplete="current-password"
              id="staff-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={copy.passwordPlaceholder}
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              className="icon-button"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              <EyeIcon hidden={!showPassword} />
            </button>
          </div>
        </div>

        {status === 'error' && (
          <div className="inline-message inline-message--error" role="alert">
            <AlertIcon />
            <span>{errorMessage}</span>
          </div>
        )}

        <button className="primary-button" disabled={status === 'submitting'} type="submit">
          {status === 'submitting' ? copy.signingIn : copy.signIn}
          {status !== 'submitting' && <ArrowRightIcon />}
        </button>
      </form>

      <div className="auth-note">
        <LockIcon />
        <p>{copy.internalNote}</p>
      </div>
    </section>
  );
}

function ForgotPasswordScreen({ copy, onBack }: { copy: AuthCopy; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (normalizedEmail.length === 0) {
      setStatus('error');
      setErrorMessage(copy.missingEmail);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setStatus('error');
      setErrorMessage(copy.invalidEmail);
      return;
    }

    setStatus('success');
    setErrorMessage('');
  }

  if (status === 'success') {
    return (
      <section className="auth-content" aria-labelledby="forgot-success-title">
        <div className="mobile-brand-header">
          <BrandHeader copy={copy} />
        </div>

        <button className="back-button" onClick={onBack} type="button">
          <ArrowLeftIcon />
          {copy.backToSignIn}
        </button>

        <div className="success-mark">
          <CheckIcon />
        </div>
        <div className="auth-heading auth-heading--compact">
          <p className="eyebrow">{copy.accountRecovery}</p>
          <h2 id="forgot-success-title">{copy.recoveryReady}</h2>
          <p>{copy.recoverySuccessDescription}</p>
        </div>

        <div className="section-divider" />

        <button className="secondary-button" onClick={onBack} type="button">
          {copy.returnToSignIn}
          <ArrowRightIcon />
        </button>
      </section>
    );
  }

  return (
    <section className="auth-content" aria-labelledby="forgot-title">
      <div className="mobile-brand-header">
        <BrandHeader copy={copy} />
      </div>

      <button className="back-button" onClick={onBack} type="button">
        <ArrowLeftIcon />
        {copy.backToSignIn}
      </button>

      <div className="auth-heading">
        <p className="eyebrow">{copy.accountRecovery}</p>
        <h2 id="forgot-title">{copy.forgotTitle}</h2>
        <p>{copy.forgotDescription}</p>
      </div>

      <div className="section-divider" />

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="recovery-email">{copy.email}</label>
          <input
            autoComplete="email"
            id="recovery-email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={copy.emailPlaceholder}
            spellCheck="false"
            type="email"
            value={email}
          />
        </div>

        {status === 'error' && (
          <div className="inline-message inline-message--error" role="alert">
            <AlertIcon />
            <span>{errorMessage}</span>
          </div>
        )}

        <button className="primary-button" type="submit">
          {copy.continue}
          <ArrowRightIcon />
        </button>
      </form>

      <div className="auth-note">
        <LockIcon />
        <p>{copy.passwordResetNote}</p>
      </div>
    </section>
  );
}

function SignedInScreen({
  copy,
  user,
  onSignOut,
}: {
  copy: AuthCopy;
  user: StaffUser;
  onSignOut: () => void;
}) {
  return (
    <section className="auth-content" aria-labelledby="signed-in-title">
      <div className="mobile-brand-header">
        <BrandHeader copy={copy} />
      </div>

      <div className="success-mark">
        <CheckIcon />
      </div>
      <div className="auth-heading auth-heading--compact">
        <p className="eyebrow">{copy.sessionActive}</p>
        <h2 id="signed-in-title">{copy.welcomeUser(user.displayName)}</h2>
        <p>{copy.activeDescription}</p>
      </div>

      <div className="session-summary">
        <div>
          <span className="session-summary__label">{copy.accessRole}</span>
          <strong>{user.roles.map((role) => copy.roleLabels[role] ?? role).join(' · ')}</strong>
        </div>
        <LockIcon />
      </div>

      <div className="section-divider" />

      <button className="secondary-button" onClick={onSignOut} type="button">
        {copy.signOut}
      </button>
    </section>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname));
  const [signedInUser, setSignedInUser] = useState<StaffUser | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });
  const copy = translations[language];
  const operationalRole = signedInUser === null ? null : operationalRoleForUser(signedInUser);
  const operationalText = operationalCopy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = signedInUser?.roles.includes('SUPERADMIN')
      ? copy.superadmin.pageTitle
      : signedInUser?.roles.includes('CAFE')
        ? copy.cafe.pageTitle
        : signedInUser?.roles.includes('RECEPTIONIST')
          ? copy.receptionist.pageTitle
          : operationalRole === null
            ? copy.pageTitle
            : operationalText.pageTitle;

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language selection still applies for this session if storage is unavailable.
    }
  }, [
    copy.cafe.pageTitle,
    copy.pageTitle,
    copy.receptionist.pageTitle,
    copy.superadmin.pageTitle,
    language,
    operationalRole,
    operationalText.pageTitle,
    signedInUser,
  ]);

  useEffect(() => {
    if (signedInUser !== null || screen === 'forgot') return undefined;

    let cancelled = false;
    void fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return;
        const currentUser = (await response.json()) as StaffUser;
        if (cancelled) return;
        setSignedInUser(currentUser);
        const landingScreen = landingScreenForUser(currentUser);
        if (landingScreen !== 'login' && !canUserStayOnScreen(currentUser, screen)) {
          window.history.replaceState({}, '', pathForScreen(landingScreen));
          setScreen(landingScreen);
        }
      })
      .catch(() => {
        // A missing session keeps the public sign-in screen visible.
      });

    return () => {
      cancelled = true;
    };
  }, [screen, signedInUser]);

  useEffect(() => {
    function handlePopState() {
      setScreen(screenFromPath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(nextScreen: Screen) {
    window.history.pushState({}, '', pathForScreen(nextScreen));
    setScreen(nextScreen);
  }

  function handleLoginSuccess(user: StaffUser) {
    setSignedInUser(user);
    navigate(landingScreenForUser(user));
  }

  async function handleSignOut() {
    try {
      await fetch(`${API_BASE_URL}/auth/staff/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clear the local session even when the API is temporarily unavailable.
    } finally {
      setSignedInUser(null);
      navigate('login');
    }
  }

  if (signedInUser?.roles.includes('SUPERADMIN')) {
    return (
      <SuperadminWorkspace
        authCopy={copy}
        initialPage={screen === 'admin-roles' ? 'roles' : 'users'}
        language={language}
        onLanguageChange={setLanguage}
        onNavigate={(page) => navigate(page === 'roles' ? 'admin-roles' : 'admin-users')}
        onSignOut={handleSignOut}
        user={signedInUser}
      />
    );
  }

  if (signedInUser?.roles.includes('CAFE')) {
    if (screen === 'cafe-menu') {
      return (
        <CafeWorkspace
          authCopy={copy}
          language={language}
          onLanguageChange={setLanguage}
          onNavigate={(page) => navigate(page === 'menu' ? 'cafe-menu' : 'cafe-orders')}
          onSignOut={handleSignOut}
          user={signedInUser}
        />
      );
    }

    return (
      <CafeDashboard
        authCopy={copy}
        language={language}
        onLanguageChange={setLanguage}
        onNavigate={(page) => navigate(page === 'menu' ? 'cafe-menu' : 'cafe-orders')}
        onSignOut={handleSignOut}
        user={signedInUser}
      />
    );
  }

  if (signedInUser?.roles.includes('RECEPTIONIST')) {
    return (
      <ReceptionistWorkspace
        authCopy={copy}
        language={language}
        onLanguageChange={setLanguage}
        onSignOut={handleSignOut}
        user={signedInUser}
      />
    );
  }

  if (signedInUser !== null && operationalRole !== null) {
    const catalogUnit = catalogUnitForRole(operationalRole);
    const catalogScreen = screenForCatalogRole(operationalRole);
    if (catalogUnit !== null && catalogScreen !== null && screen === catalogScreen) {
      return (
        <CatalogWorkspace
          authCopy={copy}
          catalogCopy={getCatalogCopy(copy, language, catalogUnit as CatalogUnit)}
          itemKind={
            catalogUnit === 'RESTAURANT' || catalogUnit === 'LOUNGE' ? 'PRODUCT' : 'SERVICE'
          }
          language={language}
          onLanguageChange={setLanguage}
          onNavigate={(page) =>
            navigate(page === 'menu' ? catalogScreen : screenForOperationalRole(operationalRole))
          }
          onSignOut={handleSignOut}
          unit={catalogUnit}
          unitCopy={catalogUnitCopy[language][catalogUnit]}
          user={signedInUser}
        />
      );
    }

    return (
      <OperationalDashboard
        authCopy={copy}
        language={language}
        onLanguageChange={setLanguage}
        onNavigate={
          catalogUnit === null || catalogScreen === null
            ? undefined
            : (page) =>
                navigate(
                  page === 'menu' ? catalogScreen : screenForOperationalRole(operationalRole),
                )
        }
        onSignOut={handleSignOut}
        role={operationalRole}
        user={signedInUser}
      />
    );
  }

  return (
    <main className="auth-shell">
      <BrandPanel copy={copy} />
      <div className="auth-panel">
        <div className="auth-panel__topbar">
          <LanguageSwitcher copy={copy} language={language} onChange={setLanguage} />
        </div>
        {signedInUser !== null ? (
          <SignedInScreen copy={copy} onSignOut={handleSignOut} user={signedInUser} />
        ) : screen === 'forgot' ? (
          <ForgotPasswordScreen copy={copy} onBack={() => navigate('login')} />
        ) : (
          <LoginScreen
            copy={copy}
            onForgot={() => navigate('forgot')}
            onSuccess={handleLoginSuccess}
          />
        )}
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} Hadith Hotel</span>
          <span>{copy.footerPlatform}</span>
        </footer>
      </div>
    </main>
  );
}
