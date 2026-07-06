import type { FormEvent } from "react";
import { LogIn, RefreshCw, UserPlus } from "lucide-react";

import type { AuthMode } from "../../shared/types";

export function AuthScreen({
  mode,
  username,
  password,
  registerName,
  registerEmail,
  registerPassword,
  loginError,
  registerError,
  busyAction,
  onModeChange,
  onUsernameChange,
  onPasswordChange,
  onRegisterNameChange,
  onRegisterEmailChange,
  onRegisterPasswordChange,
  onLogin,
  onRegister
}: {
  mode: AuthMode;
  username: string;
  password: string;
  registerName: string;
  registerEmail: string;
  registerPassword: string;
  loginError: string;
  registerError: string;
  busyAction: string;
  onModeChange: (value: AuthMode) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRegisterNameChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onRegisterPasswordChange: (value: string) => void;
  onLogin: (event?: FormEvent) => void;
  onRegister: (event?: FormEvent) => void;
}) {
  const signingIn = busyAction === "login";
  const registering = busyAction === "register";
  return (
    <main className="auth-screen" aria-label="Authentication">
      <section className="auth-panel">
        <div className="auth-heading">
          <span className="auth-mark" aria-hidden="true">K</span>
          <h1>Unified Operating Kernel</h1>
          <p className="auth-copy">Sign in to continue to the operations workbench.</p>
        </div>

        <div className="auth-mode-control" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => onModeChange("signin")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => onModeChange("register")}>Register</button>
        </div>

        {mode === "signin" ? (
          <form className="auth-form" onSubmit={onLogin}>
            <label className="field">
              <span>Email or username</span>
              <input type="text" value={username} onChange={(event) => onUsernameChange(event.target.value)} autoComplete="username" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} autoComplete="current-password" />
            </label>
            {loginError && <div className="signin-error" role="alert">{loginError}</div>}
            <button type="submit" className="command-button primary auth-submit" disabled={signingIn} aria-busy={signingIn || undefined}>
              {signingIn ? <RefreshCw size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
              <span>{signingIn ? "Working" : "Log in"}</span>
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={onRegister}>
            <label className="field">
              <span>Name</span>
              <input type="text" value={registerName} onChange={(event) => onRegisterNameChange(event.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={registerEmail} onChange={(event) => onRegisterEmailChange(event.target.value)} autoComplete="email" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={registerPassword} onChange={(event) => onRegisterPasswordChange(event.target.value)} autoComplete="new-password" />
            </label>
            {registerError && <div className="signin-error" role="alert">{registerError}</div>}
            <button type="submit" className="command-button primary auth-submit" disabled={registering} aria-busy={registering || undefined}>
              {registering ? <RefreshCw size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              <span>{registering ? "Working" : "Register"}</span>
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
