import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { FormEvent, MouseEvent, ReactNode } from 'react';

import {
  managementApi,
  StaffApiError,
  type CreateRoleInput,
  type CreateUserInput,
  type ManagedRole,
  type ManagedUser,
  type UpdateRoleInput,
  type UpdateUserInput,
} from './management-api';
import { AdminSelect } from './AdminSelect';
import type { AuthCopy, Language, SuperadminCopy } from './i18n';

interface StaffUser {
  displayName: string;
  roles: string[];
}

type AdminPage = 'users' | 'roles';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
interface ActionMenuState {
  left: number;
  top: number;
  userId: string;
}
type DrawerState =
  | { type: 'create-user' }
  | { type: 'edit-user'; user: ManagedUser }
  | { type: 'reset-password'; user: ManagedUser }
  | { type: 'create-role' }
  | { type: 'edit-role'; role: ManagedRole }
  | null;
type ConfirmationState =
  | { type: 'deactivate' | 'reactivate'; user: ManagedUser }
  | { type: 'delete-role'; role: ManagedRole }
  | null;

interface SuperadminWorkspaceProps {
  authCopy: AuthCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onSignOut: () => void;
  user: StaffUser;
  initialPage: AdminPage;
  onNavigate: (page: AdminPage) => void;
}

interface UserFormDraft {
  displayName: string;
  email: string;
  roles: string[];
  password: string;
  confirmPassword: string;
}

interface RoleFormDraft {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

const PERMISSION_GROUPS = [
  {
    key: 'identity',
    codes: ['user:manage', 'role:manage'],
  },
  {
    key: 'operations',
    codes: ['request:view', 'request:confirm', 'request:complete', 'request:history'],
  },
  {
    key: 'department',
    codes: [
      'room-manager:monitor',
      'receptionist:rooms:view',
      'receptionist:guest:assign',
      'receptionist:guest:update',
      'receptionist:guest:checkout',
      'receptionist:tv:pair',
    ],
  },
  {
    key: 'catalog',
    codes: ['menu:manage'],
  },
] as const;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? '—';
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function formatUpdatedAt(value: string, language: Language): string {
  const locale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function roleLabel(role: string, copy: AuthCopy, roles: readonly ManagedRole[]): string {
  return copy.roleLabels[role] ?? roles.find((candidate) => candidate.code === role)?.name ?? role;
}

function errorMessage(error: unknown, copy: SuperadminCopy): string {
  if (error instanceof StaffApiError) {
    if (error.code === 'STAFF_EMAIL_CONFLICT') return copy.duplicateEmail;
    if (error.code === 'INVALID_ROLE_ASSIGNMENT') return copy.roleAssignmentError;
    if (error.code === 'ROLE_ASSIGNED') return copy.cannotDeleteAssignedRole;
    if (error.code === 'SESSION_EXPIRED' || error.status === 401) return copy.sessionExpired;
  }
  return copy.apiError;
}

function AdminBrandMark() {
  return (
    <div className="admin-brand-mark" aria-hidden="true">
      <span>✦</span>
      <strong>H</strong>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.8 19c.7-3.3 2.4-5 5.2-5s4.5 1.7 5.2 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M16 5.5a3 3 0 0 1 0 5.7M17 14.2c1.9.6 3 2.2 3.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5 19 6v5.1c0 4.2-2.4 7.6-7 9.4-4.6-1.8-7-5.2-7-9.4V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8.8 12 2.1 2.1 4.4-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="4" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="8.7" cy="8.7" r="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.3 12.3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: 'right' | 'left' }) {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      {direction === 'right' ? (
        <path
          d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M16 10H5M9.5 5.5 5 10l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      {visible ? (
        <>
          <path
            d="M3 10c1.6-3.1 4-4.7 7-4.7s5.4 1.6 7 4.7c-1.6 3.1-4 4.7-7 4.7S4.6 13.1 3 10Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : (
        <>
          <path
            d="M3 3.5 17 16.5M8.3 8.4a2.4 2.4 0 0 0 3.3 3.3M5.2 5.7C3.8 6.9 3 8.4 3 10c1.6 3.1 4 4.7 7 4.7 1.3 0 2.5-.3 3.5-.9M6.7 4.5c1-.5 2.1-.8 3.3-.8 3 0 5.4 1.6 7 4.7-.4.8-.9 1.5-1.5 2.1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m4 10.3 3.5 3.4L16 5.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminLanguageSwitcher({
  authCopy,
  language,
  onChange,
}: {
  authCopy: AuthCopy;
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="admin-language-switcher" aria-label={authCopy.languageLabel}>
      {(['uz', 'ru', 'en'] as const).map((option) => (
        <button
          aria-pressed={language === option}
          className={
            language === option ? 'admin-language-option is-active' : 'admin-language-option'
          }
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === 'uz' ? "O'z" : option === 'ru' ? 'Рус' : 'Eng'}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ active, copy }: { active: boolean; copy: SuperadminCopy }) {
  return (
    <span className={active ? 'status-pill status-pill--active' : 'status-pill'}>
      {active ? copy.active : copy.inactive}
    </span>
  );
}

function RolePill({
  role,
  copy,
  roles,
}: {
  role: string;
  copy: AuthCopy;
  roles: readonly ManagedRole[];
}) {
  return <span className="role-pill">{roleLabel(role, copy, roles)}</span>;
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-state__mark">—</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LoadingState({ copy }: { copy: SuperadminCopy }) {
  return (
    <div className="admin-loading-state" aria-live="polite">
      <span className="admin-loading-line admin-loading-line--wide" />
      <span className="admin-loading-line" />
      <span className="admin-loading-line admin-loading-line--short" />
      <p>{copy.loading}</p>
    </div>
  );
}

function Drawer({
  title,
  eyebrow,
  children,
  onClose,
  copy,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  copy: SuperadminCopy;
}) {
  return (
    <div
      className="admin-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside aria-label={title} aria-modal="true" className="admin-drawer" role="dialog">
        <div className="admin-drawer__header">
          <div>
            {eyebrow !== undefined && <p className="admin-eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button
            aria-label={copy.close}
            className="admin-icon-button"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="admin-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <div className="admin-password-field">
        <input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? hideLabel : showLabel}
          className="admin-icon-button"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

function UserDrawer({
  copy,
  authCopy,
  roles,
  user,
  onClose,
  onSaved,
}: {
  copy: SuperadminCopy;
  authCopy: AuthCopy;
  roles: ManagedRole[];
  user: ManagedUser | null;
  onClose: () => void;
  onSaved: (user: ManagedUser, message: string) => void;
}) {
  const [draft, setDraft] = useState<UserFormDraft>(() => ({
    displayName: user?.displayName ?? '',
    email: user?.email ?? '',
    roles: user?.roles ?? [],
    password: '',
    confirmPassword: '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditing = user !== null;

  function toggleRole(role: string) {
    setDraft((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((candidate) => candidate !== role)
        : [...current.roles, role],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = draft.email.trim();
    if (
      draft.displayName.trim().length === 0 ||
      normalizedEmail.length === 0 ||
      draft.roles.length === 0
    ) {
      setError(draft.roles.length === 0 ? copy.roleRequired : copy.requiredField);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError(copy.invalidEmail);
      return;
    }
    if (!isEditing && draft.password.length < 8) {
      setError(copy.passwordRequired);
      return;
    }
    if (draft.password.length > 0 && draft.password !== draft.confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let saved: ManagedUser;
      if (isEditing) {
        const input: UpdateUserInput = {
          email: normalizedEmail,
          displayName: draft.displayName.trim(),
          roles: draft.roles,
        };
        saved = await managementApi.updateUser(user.id, input);
        onSaved(saved, copy.updateSuccess);
      } else {
        const input: CreateUserInput = {
          email: normalizedEmail,
          displayName: draft.displayName.trim(),
          roles: draft.roles,
          password: draft.password,
        };
        saved = await managementApi.createUser(input);
        onSaved(saved, copy.createSuccess);
      }
    } catch (requestError) {
      setError(errorMessage(requestError, copy));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      copy={copy}
      eyebrow={copy.userDetails}
      onClose={onClose}
      title={isEditing ? copy.editUser : copy.createUser}
    >
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="admin-form-intro">
          <div className="admin-form-avatar">{getInitials(draft.displayName || copy.user)}</div>
          <p>{isEditing ? copy.usersSubtitle : copy.passwordHint}</p>
        </div>
        <div className="admin-field">
          <label htmlFor="admin-user-name">{copy.displayName}</label>
          <input
            id="admin-user-name"
            onChange={(event) =>
              setDraft((current) => ({ ...current, displayName: event.target.value }))
            }
            placeholder={copy.displayNamePlaceholder}
            value={draft.displayName}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-user-email">{copy.email}</label>
          <input
            autoComplete="email"
            id="admin-user-email"
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            placeholder={authCopy.emailPlaceholder}
            type="email"
            value={draft.email}
          />
        </div>
        <fieldset className="admin-role-fieldset">
          <legend>{copy.assignedRoles}</legend>
          <div className="admin-role-options">
            {roles.map((role) => (
              <button
                className={
                  draft.roles.includes(role.code)
                    ? 'admin-role-option is-selected'
                    : 'admin-role-option'
                }
                key={role.id}
                onClick={() => toggleRole(role.code)}
                type="button"
              >
                <span>{roleLabel(role.code, authCopy, roles)}</span>
                {draft.roles.includes(role.code) && <CheckIcon />}
              </button>
            ))}
          </div>
        </fieldset>
        {!isEditing && (
          <>
            <PasswordInput
              hideLabel={authCopy.hidePassword}
              id="admin-user-password"
              label={copy.initialPassword}
              onChange={(password) => setDraft((current) => ({ ...current, password }))}
              placeholder={authCopy.passwordPlaceholder}
              showLabel={authCopy.showPassword}
              value={draft.password}
            />
            <PasswordInput
              hideLabel={authCopy.hidePassword}
              id="admin-user-password-confirm"
              label={copy.confirmPassword}
              onChange={(confirmPassword) =>
                setDraft((current) => ({ ...current, confirmPassword }))
              }
              placeholder={authCopy.passwordPlaceholder}
              showLabel={authCopy.showPassword}
              value={draft.confirmPassword}
            />
            <p className="admin-field-hint">{copy.passwordHint}</p>
          </>
        )}
        {error.length > 0 && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button
            className="admin-button admin-button--quiet"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {copy.cancel}
          </button>
          <button className="admin-button admin-button--primary" disabled={saving} type="submit">
            {saving ? copy.loading : copy.saveUser}
            <ArrowIcon direction="right" />
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function PasswordDrawer({
  copy,
  authCopy,
  user,
  onClose,
  onSaved,
}: {
  copy: SuperadminCopy;
  authCopy: AuthCopy;
  user: ManagedUser;
  onClose: () => void;
  onSaved: (user: ManagedUser, message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError(copy.passwordRequired);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await managementApi.resetPassword(user.id, password);
      onSaved(saved, copy.saveSuccess);
    } catch (requestError) {
      setError(errorMessage(requestError, copy));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      copy={copy}
      eyebrow={copy.resetPassword}
      onClose={onClose}
      title={copy.resetPasswordTitle}
    >
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="admin-form-intro admin-form-intro--plain">
          <p>{copy.resetPasswordDescription(user.displayName)}</p>
        </div>
        <PasswordInput
          hideLabel={authCopy.hidePassword}
          id="admin-reset-password"
          label={copy.newPassword}
          onChange={setPassword}
          placeholder={copy.newPassword}
          showLabel={authCopy.showPassword}
          value={password}
        />
        <PasswordInput
          hideLabel={authCopy.hidePassword}
          id="admin-reset-password-confirm"
          label={copy.confirmNewPassword}
          onChange={setConfirmPassword}
          placeholder={copy.confirmNewPassword}
          showLabel={authCopy.showPassword}
          value={confirmPassword}
        />
        <p className="admin-field-hint">{copy.passwordHint}</p>
        {error.length > 0 && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button
            className="admin-button admin-button--quiet"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {copy.cancel}
          </button>
          <button className="admin-button admin-button--primary" disabled={saving} type="submit">
            {saving ? copy.loading : copy.resetPasswordAction}
            <ArrowIcon direction="right" />
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function PermissionGroups({
  copy,
  permissions,
  readonly,
  onToggle,
}: {
  copy: SuperadminCopy;
  permissions: string[];
  readonly: boolean;
  onToggle?: (permission: string) => void;
}) {
  const groupLabels: Record<(typeof PERMISSION_GROUPS)[number]['key'], string> = {
    identity: copy.permissionGroupIdentity,
    operations: copy.permissionGroupOperations,
    department: copy.permissionGroupDepartment,
    catalog: copy.permissionGroupCatalog,
  };
  return (
    <div className="permission-groups">
      {PERMISSION_GROUPS.map((group) => (
        <section className="permission-group" key={group.key}>
          <h3>{groupLabels[group.key]}</h3>
          <div className="permission-list">
            {group.codes.map((permission) => {
              const details = copy.permissionLabels[permission];
              const selected = permissions.includes(permission);
              return (
                <button
                  className={selected ? 'permission-row is-selected' : 'permission-row'}
                  disabled={readonly}
                  key={permission}
                  onClick={() => onToggle?.(permission)}
                  type="button"
                >
                  <span className="permission-check">{selected && <CheckIcon />}</span>
                  <span className="permission-copy">
                    <strong>{details?.label ?? permission}</strong>
                    <small>{details?.description ?? permission}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoleDrawer({
  copy,
  role,
  onClose,
  onSaved,
}: {
  copy: SuperadminCopy;
  role: ManagedRole | null;
  onClose: () => void;
  onSaved: (role: ManagedRole, message: string) => void;
}) {
  const [draft, setDraft] = useState<RoleFormDraft>(() => ({
    code: role?.code ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role?.permissions ?? [],
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditing = role !== null;

  function togglePermission(permission: string) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((candidate) => candidate !== permission)
        : [...current.permissions, permission],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.name.trim().length === 0 || draft.description.trim().length === 0) {
      setError(copy.requiredField);
      return;
    }
    if (!isEditing && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(draft.code.trim())) {
      setError(copy.codeInvalid);
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved: ManagedRole;
      if (isEditing) {
        const input: UpdateRoleInput = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          permissions: draft.permissions,
        };
        saved = await managementApi.updateRole(role.id, input);
        onSaved(saved, copy.roleUpdated);
      } else {
        const input: CreateRoleInput = {
          code: draft.code.trim(),
          name: draft.name.trim(),
          description: draft.description.trim(),
          permissions: draft.permissions,
        };
        saved = await managementApi.createRole(input);
        onSaved(saved, copy.roleCreated);
      }
    } catch (requestError) {
      setError(errorMessage(requestError, copy));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      copy={copy}
      eyebrow={copy.permissions}
      onClose={onClose}
      title={isEditing ? copy.editRole : copy.createRole}
    >
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        {!isEditing && (
          <div className="admin-field">
            <label htmlFor="admin-role-code">{copy.roleCode}</label>
            <input
              id="admin-role-code"
              onChange={(event) =>
                setDraft((current) => ({ ...current, code: event.target.value }))
              }
              placeholder="ROOM_SERVICE_LEAD"
              value={draft.code}
            />
            <p className="admin-field-hint">{copy.roleCodeHint}</p>
          </div>
        )}
        <div className="admin-field">
          <label htmlFor="admin-role-name">{copy.roleName}</label>
          <input
            id="admin-role-name"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder={copy.roleName}
            value={draft.name}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-role-description">{copy.roleDescription}</label>
          <textarea
            id="admin-role-description"
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
            placeholder={copy.roleDescriptionPlaceholder}
            rows={4}
            value={draft.description}
          />
        </div>
        <fieldset className="admin-role-fieldset">
          <legend>{copy.permissions}</legend>
          <PermissionGroups
            copy={copy}
            onToggle={togglePermission}
            permissions={draft.permissions}
            readonly={false}
          />
        </fieldset>
        {error.length > 0 && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button
            className="admin-button admin-button--quiet"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {copy.cancel}
          </button>
          <button className="admin-button admin-button--primary" disabled={saving} type="submit">
            {saving ? copy.loading : copy.saveRole}
            <ArrowIcon direction="right" />
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function ConfirmDialog({
  copy,
  confirmation,
  saving,
  onClose,
  onConfirm,
}: {
  copy: SuperadminCopy;
  confirmation: Exclude<ConfirmationState, null>;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDelete = confirmation.type === 'delete-role';
  const name = isDelete ? confirmation.role.name : confirmation.user.displayName;
  const title = isDelete
    ? copy.deleteRoleTitle
    : confirmation.type === 'deactivate'
      ? copy.deactivateTitle
      : copy.reactivateTitle;
  const description = isDelete
    ? copy.deleteRoleDescription(name)
    : confirmation.type === 'deactivate'
      ? copy.deactivateDescription(name)
      : copy.reactivateDescription(name);
  const actionLabel = isDelete
    ? copy.confirmDelete
    : confirmation.type === 'deactivate'
      ? copy.confirmDeactivate
      : copy.confirmReactivate;

  return (
    <div className="admin-overlay admin-overlay--center" role="presentation">
      <div aria-modal="true" className="admin-confirm-dialog" role="dialog">
        <div
          className={
            isDelete ? 'admin-confirm-icon admin-confirm-icon--danger' : 'admin-confirm-icon'
          }
        >
          {isDelete ? '×' : '?'}
        </div>
        <p className="admin-eyebrow">{copy.accessManagement}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="admin-form-actions">
          <button
            className="admin-button admin-button--quiet"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {copy.cancel}
          </button>
          <button
            className={
              isDelete || confirmation.type === 'deactivate'
                ? 'admin-button admin-button--danger'
                : 'admin-button admin-button--primary'
            }
            disabled={saving}
            onClick={onConfirm}
            type="button"
          >
            {saving ? copy.loading : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersPage({
  authCopy,
  copy,
  language,
  loading,
  users,
  roles,
  onAdd,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  authCopy: AuthCopy;
  copy: SuperadminCopy;
  language: Language;
  loading: boolean;
  users: ManagedUser[];
  roles: ManagedRole[];
  onAdd: () => void;
  onEdit: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
  onToggleActive: (user: ManagedUser) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [role, setRole] = useState('ALL');
  const [openActionMenu, setOpenActionMenu] = useState<ActionMenuState | null>(null);

  useEffect(() => {
    const closeActionMenu = () => setOpenActionMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest('.admin-action-menu') &&
        !target.closest('.admin-hover-actions')
      ) {
        closeActionMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', closeActionMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', closeActionMenu, true);
    };
  }, []);

  const toggleActionMenu = (userId: string, event: MouseEvent<HTMLButtonElement>) => {
    if (openActionMenu?.userId === userId) {
      setOpenActionMenu(null);
      return;
    }

    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 145;
    const gap = 8;
    const viewportMargin = 12;
    const maximumLeft = Math.max(viewportMargin, window.innerWidth - menuWidth - viewportMargin);
    const left = Math.min(Math.max(viewportMargin, buttonRect.right - menuWidth), maximumLeft);
    const top =
      buttonRect.bottom + menuHeight + gap <= window.innerHeight - viewportMargin
        ? buttonRect.bottom + gap
        : Math.max(viewportMargin, buttonRect.top - menuHeight - gap);

    setOpenActionMenu({ left, top, userId });
  };
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        query.length === 0 ||
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? user.active : !user.active);
      const matchesRole = role === 'ALL' || user.roles.includes(role);
      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [role, search, status, users]);
  const activeCount = users.filter((user) => user.active).length;
  const rolesInUse = new Set(users.flatMap((user) => user.roles)).size;

  return (
    <section className="admin-page" aria-labelledby="admin-users-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{copy.workspaceLabel}</p>
          <h1 id="admin-users-title">{copy.users}</h1>
          <p>{copy.usersSubtitle}</p>
        </div>
        <button className="admin-button admin-button--primary" onClick={onAdd} type="button">
          <PlusIcon />
          {copy.addUser}
        </button>
      </div>

      <div className="admin-stat-strip" aria-label={copy.users}>
        <div>
          <span>{copy.totalUsers}</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <span>{copy.activeUsers}</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>{copy.rolesInUse}</span>
          <strong>{rolesInUse}</strong>
        </div>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search-field">
          <span className="sr-only">{copy.searchUsers}</span>
          <SearchIcon />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchUsersPlaceholder}
            value={search}
          />
        </label>
        <AdminSelect
          ariaLabel={copy.status}
          className="admin-filter-field"
          onChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { label: copy.allStatuses, value: 'ALL' },
            { label: copy.active, value: 'ACTIVE' },
            { label: copy.inactive, value: 'INACTIVE' },
          ]}
          value={status}
        />
        <AdminSelect
          ariaLabel={copy.role}
          className="admin-filter-field"
          onChange={setRole}
          options={[
            { label: copy.allRoles, value: 'ALL' },
            ...roles.map((candidate) => ({
              label: roleLabel(candidate.code, authCopy, roles),
              value: candidate.code,
            })),
          ]}
          value={role}
        />
        <span className="admin-toolbar-count">{copy.showing(filteredUsers.length)}</span>
      </div>

      {loading ? (
        <LoadingState copy={copy} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          description={copy.noUsersDescription}
          title={copy.noUsers}
          action={
            <button className="admin-text-button" onClick={onAdd} type="button">
              {copy.addUser}
              <ArrowIcon direction="right" />
            </button>
          }
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{copy.user}</th>
                <th>{copy.role}</th>
                <th>{copy.status}</th>
                <th>{copy.updated}</th>
                <th>
                  <span className="sr-only">{copy.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const actionMenu = openActionMenu?.userId === user.id ? openActionMenu : null;

                return (
                  <tr key={user.id}>
                    <td data-label={copy.user}>
                      <div className="admin-user-cell">
                        <span className="admin-avatar">{getInitials(user.displayName)}</span>
                        <span>
                          <strong>{user.displayName}</strong>
                          <small>{user.email}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label={copy.role}>
                      <div className="admin-role-list">
                        {user.roles.map((userRole) => (
                          <RolePill copy={authCopy} key={userRole} role={userRole} roles={roles} />
                        ))}
                      </div>
                    </td>
                    <td data-label={copy.status}>
                      <StatusPill active={user.active} copy={copy} />
                    </td>
                    <td data-label={copy.updated}>
                      <span className="admin-date">
                        {formatUpdatedAt(user.updatedAt, language)}
                      </span>
                    </td>
                    <td className="admin-table-actions">
                      <div className="admin-action-menu">
                        <button
                          aria-label={`${copy.actions}: ${user.displayName}`}
                          aria-expanded={actionMenu !== null}
                          aria-controls={`admin-user-actions-${user.id}`}
                          aria-haspopup="menu"
                          className="admin-more-button"
                          onClick={(event) => toggleActionMenu(user.id, event)}
                          type="button"
                        >
                          <MoreIcon />
                        </button>
                        {actionMenu &&
                          createPortal(
                            <div
                              id={`admin-user-actions-${user.id}`}
                              className="admin-hover-actions"
                              role="menu"
                              style={{ left: actionMenu.left, top: actionMenu.top }}
                            >
                              <button
                                onClick={() => {
                                  setOpenActionMenu(null);
                                  onEdit(user);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {copy.edit}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenActionMenu(null);
                                  onResetPassword(user);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {copy.resetPassword}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenActionMenu(null);
                                  onToggleActive(user);
                                }}
                                role="menuitem"
                                type="button"
                              >
                                {user.active ? copy.deactivate : copy.reactivate}
                              </button>
                            </div>,
                            document.body,
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RolesPage({
  authCopy,
  copy,
  loading,
  roles,
  selectedRoleId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: {
  authCopy: AuthCopy;
  copy: SuperadminCopy;
  loading: boolean;
  roles: ManagedRole[];
  selectedRoleId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (role: ManagedRole) => void;
  onDelete: (role: ManagedRole) => void;
}) {
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  return (
    <section className="admin-page" aria-labelledby="admin-roles-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{copy.workspaceLabel}</p>
          <h1 id="admin-roles-title">{copy.roles}</h1>
          <p>{copy.rolesSubtitle}</p>
        </div>
        <button className="admin-button admin-button--primary" onClick={onAdd} type="button">
          <PlusIcon />
          {copy.createRole}
        </button>
      </div>
      {loading ? (
        <LoadingState copy={copy} />
      ) : roles.length === 0 ? (
        <EmptyState
          description={copy.noRolesDescription}
          title={copy.noRoles}
          action={
            <button className="admin-button admin-button--primary" onClick={onAdd} type="button">
              <PlusIcon />
              {copy.createRole}
            </button>
          }
        />
      ) : (
        <div className="roles-workspace">
          <aside className="role-list" aria-label={copy.roles}>
            <div className="role-list__header">
              <span>{copy.accessManagement}</span>
              <strong>{roles.length}</strong>
            </div>
            <div className="role-list__items">
              {roles.map((role) => (
                <button
                  className={
                    role.id === selectedRole?.id ? 'role-list-item is-selected' : 'role-list-item'
                  }
                  key={role.id}
                  onClick={() => onSelect(role.id)}
                  type="button"
                >
                  <span className="role-list-item__icon">
                    {role.system ? <ShieldIcon /> : <UsersIcon />}
                  </span>
                  <span className="role-list-item__copy">
                    <strong>{roleLabel(role.code, authCopy, roles)}</strong>
                    <small>
                      {role.system ? copy.systemRole : copy.customRole} ·{' '}
                      {copy.usersCount(role.userCount)}
                    </small>
                  </span>
                  <ArrowIcon direction="right" />
                </button>
              ))}
            </div>
          </aside>
          {selectedRole !== undefined && (
            <div className="role-detail">
              <div className="role-detail__header">
                <div className="role-detail__identity">
                  <span
                    className={
                      selectedRole.system
                        ? 'role-detail__mark role-detail__mark--system'
                        : 'role-detail__mark'
                    }
                  >
                    {selectedRole.system ? <ShieldIcon /> : <UsersIcon />}
                  </span>
                  <div>
                    <div className="admin-badge-row">
                      <span className="admin-eyebrow">
                        {selectedRole.system ? copy.systemRole : copy.customRole}
                      </span>
                      {selectedRole.system && (
                        <span className="protected-badge">{copy.protectedRole}</span>
                      )}
                    </div>
                    <h2>{roleLabel(selectedRole.code, authCopy, roles)}</h2>
                    <code>{selectedRole.code}</code>
                  </div>
                </div>
                <div className="role-detail__actions">
                  {selectedRole.system ? (
                    <span className="protected-note">
                      <ShieldIcon />
                      {copy.lockedSystemRole}
                    </span>
                  ) : (
                    <>
                      <button
                        className="admin-button admin-button--quiet"
                        onClick={() => onEdit(selectedRole)}
                        type="button"
                      >
                        {copy.edit}
                      </button>
                      <button
                        aria-label={copy.deleteRole}
                        className="admin-button admin-button--danger-quiet"
                        onClick={() => onDelete(selectedRole)}
                        type="button"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="role-detail__meta">
                <p>{copy.roleDescription}</p>
                <strong>
                  {copy.roleDescriptions[selectedRole.code] ?? selectedRole.description}
                </strong>
                <div>
                  <span>{copy.usersCount(selectedRole.userCount)}</span>
                  <span>
                    {copy.permissions}: {selectedRole.permissions.length}
                  </span>
                </div>
              </div>
              <div className="role-detail__divider" />
              <div className="role-detail__section-heading">
                <div>
                  <p className="admin-eyebrow">{copy.accessManagement}</p>
                  <h3>{copy.permissions}</h3>
                </div>
                <span>
                  {selectedRole.permissions.length === 0
                    ? copy.noPermissionSelected
                    : copy.permissionsCount(selectedRole.permissions.length)}
                </span>
              </div>
              <PermissionGroups copy={copy} permissions={selectedRole.permissions} readonly />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function SuperadminWorkspace({
  authCopy,
  language,
  onLanguageChange,
  onSignOut,
  user,
  initialPage,
  onNavigate,
}: SuperadminWorkspaceProps) {
  const copy = authCopy.superadmin;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [page, setPage] = useState<AdminPage>(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  async function loadManagement() {
    setLoading(true);
    setError('');
    try {
      const [userResponse, roleResponse] = await Promise.all([
        managementApi.listUsers(),
        managementApi.listRoles(),
      ]);
      setUsers(userResponse.items);
      setRoles(roleResponse.items);
      setSelectedRoleId((current) => current ?? roleResponse.items[0]?.id ?? null);
    } catch (requestError) {
      setError(errorMessage(requestError, copy));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManagement();
  }, []);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (toast.length === 0) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(nextPage: AdminPage) {
    setPage(nextPage);
    onNavigate(nextPage);
  }

  function showToast(message: string) {
    setToast(message);
  }

  function handleUserSaved(saved: ManagedUser, message: string) {
    setUsers((current) => {
      const existing = current.some((userRecord) => userRecord.id === saved.id);
      return existing
        ? current.map((userRecord) => (userRecord.id === saved.id ? saved : userRecord))
        : [saved, ...current];
    });
    setDrawer(null);
    showToast(message);
  }

  function handleRoleSaved(saved: ManagedRole, message: string) {
    setRoles((current) => {
      const existing = current.some((roleRecord) => roleRecord.id === saved.id);
      return existing
        ? current.map((roleRecord) => (roleRecord.id === saved.id ? saved : roleRecord))
        : [...current, saved];
    });
    setSelectedRoleId(saved.id);
    setDrawer(null);
    showToast(message);
    void loadManagement();
  }

  async function handleConfirm() {
    if (confirmation === null) return;
    setConfirming(true);
    try {
      if (confirmation.type === 'delete-role') {
        await managementApi.deleteRole(confirmation.role.id);
        setRoles((current) => current.filter((role) => role.id !== confirmation.role.id));
        setSelectedRoleId((current) => (current === confirmation.role.id ? null : current));
        showToast(copy.roleDeleted);
      } else {
        const saved =
          confirmation.type === 'deactivate'
            ? await managementApi.deactivateUser(confirmation.user.id)
            : await managementApi.reactivateUser(confirmation.user.id);
        setUsers((current) =>
          current.map((userRecord) => (userRecord.id === saved.id ? saved : userRecord)),
        );
        showToast(confirmation.type === 'deactivate' ? copy.saveSuccess : copy.saveSuccess);
      }
      setConfirmation(null);
    } catch (requestError) {
      setError(errorMessage(requestError, copy));
    } finally {
      setConfirming(false);
    }
  }

  const pageTitle = page === 'users' ? copy.users : copy.roles;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <AdminBrandMark />
          <div>
            <strong>Hadith Hotel</strong>
            <span>{copy.administration}</span>
          </div>
        </div>
        <div className="admin-sidebar__rule" />
        <p className="admin-sidebar__label">{copy.mainNavigation}</p>
        <nav aria-label={copy.mainNavigation} className="admin-sidebar__nav">
          <button
            className={page === 'users' ? 'admin-nav-item is-active' : 'admin-nav-item'}
            onClick={() => navigate('users')}
            type="button"
          >
            <UsersIcon />
            <span>{copy.users}</span>
            <ArrowIcon direction="right" />
          </button>
          <button
            className={page === 'roles' ? 'admin-nav-item is-active' : 'admin-nav-item'}
            onClick={() => navigate('roles')}
            type="button"
          >
            <ShieldIcon />
            <span>{copy.roles}</span>
            <ArrowIcon direction="right" />
          </button>
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>{copy.administration}</span>
            <ArrowIcon direction="right" />
            <strong>{pageTitle}</strong>
          </div>
          <div className="admin-topbar__actions">
            <AdminLanguageSwitcher
              authCopy={authCopy}
              language={language}
              onChange={onLanguageChange}
            />
            <div className="admin-topbar__user">
              <span className="admin-avatar admin-avatar--small">
                {getInitials(user.displayName)}
              </span>
              <span>
                <strong>{user.displayName}</strong>
                <small>
                  {copy.signedInAs} · {roleLabel('SUPERADMIN', authCopy, roles)}
                </small>
              </span>
            </div>
            <button className="admin-signout" onClick={onSignOut} type="button">
              {authCopy.signOut}
            </button>
          </div>
        </header>
        <main className="admin-content">
          {error.length > 0 && (
            <div className="admin-global-error" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadManagement()} type="button">
                {copy.retry}
              </button>
            </div>
          )}
          {page === 'users' ? (
            <UsersPage
              authCopy={authCopy}
              copy={copy}
              language={language}
              loading={loading}
              onAdd={() => setDrawer({ type: 'create-user' })}
              onEdit={(selectedUser) => setDrawer({ type: 'edit-user', user: selectedUser })}
              onResetPassword={(selectedUser) =>
                setDrawer({ type: 'reset-password', user: selectedUser })
              }
              onToggleActive={(selectedUser) =>
                setConfirmation({
                  type: selectedUser.active ? 'deactivate' : 'reactivate',
                  user: selectedUser,
                })
              }
              roles={roles}
              users={users}
            />
          ) : (
            <RolesPage
              authCopy={authCopy}
              copy={copy}
              loading={loading}
              onAdd={() => setDrawer({ type: 'create-role' })}
              onDelete={(selectedRole) =>
                setConfirmation({ type: 'delete-role', role: selectedRole })
              }
              onEdit={(selectedRole) => setDrawer({ type: 'edit-role', role: selectedRole })}
              onSelect={setSelectedRoleId}
              roles={roles}
              selectedRoleId={selectedRoleId}
            />
          )}
        </main>
      </div>
      {drawer?.type === 'create-user' && (
        <UserDrawer
          authCopy={authCopy}
          copy={copy}
          onClose={() => setDrawer(null)}
          onSaved={handleUserSaved}
          roles={roles}
          user={null}
        />
      )}
      {drawer?.type === 'edit-user' && (
        <UserDrawer
          authCopy={authCopy}
          copy={copy}
          onClose={() => setDrawer(null)}
          onSaved={handleUserSaved}
          roles={roles}
          user={drawer.user}
        />
      )}
      {drawer?.type === 'reset-password' && (
        <PasswordDrawer
          authCopy={authCopy}
          copy={copy}
          onClose={() => setDrawer(null)}
          onSaved={handleUserSaved}
          user={drawer.user}
        />
      )}
      {drawer?.type === 'create-role' && (
        <RoleDrawer
          copy={copy}
          onClose={() => setDrawer(null)}
          onSaved={handleRoleSaved}
          role={null}
        />
      )}
      {drawer?.type === 'edit-role' && (
        <RoleDrawer
          copy={copy}
          onClose={() => setDrawer(null)}
          onSaved={handleRoleSaved}
          role={drawer.role}
        />
      )}
      {confirmation !== null && (
        <ConfirmDialog
          confirmation={confirmation}
          copy={copy}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void handleConfirm()}
          saving={confirming}
        />
      )}
      {toast.length > 0 && (
        <div className="admin-toast" role="status">
          <CheckIcon />
          {toast}
        </div>
      )}
    </div>
  );
}
