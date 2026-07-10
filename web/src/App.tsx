import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useWorkbench, type Workbench } from "./app/useWorkbench";
import { AppsManagerPanel } from "./features/apps/AppsManagerPanel";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AccountMenu } from "./features/layout/AccountMenu";
import { moduleSections, renderModuleSurface } from "./features/modules/moduleSurfaceRegistry";
import { coreSections } from "./shared/options";
import { JsonBlock, MetricGrid, StatusRow } from "./shared/data-display";
import { Pane } from "./shared/layout";
import { UokLocalizationProvider, useUokLocalization } from "./shared/localization";

export function App() {
  const workbench = useWorkbench();
  return <UokLocalizationProvider locale={workbench.locale}><AppView workbench={workbench} /></UokLocalizationProvider>;
}

function AppView({ workbench }: { workbench: Workbench }) {
  const { t } = useUokLocalization();
  const sections = [
    ...coreSections.slice(0, 2),
    ...moduleSections,
    ...coreSections.slice(2)
  ];

  if (!workbench.token) {
    return (
      <AuthScreen
        mode={workbench.authMode}
        username={workbench.username}
        password={workbench.password}
        registerName={workbench.registerName}
        registerEmail={workbench.registerEmail}
        registerPassword={workbench.registerPassword}
        loginError={workbench.loginError}
        registerError={workbench.registerError}
        busyAction={workbench.busyAction}
        onModeChange={workbench.setAuthMode}
        onUsernameChange={workbench.setUsername}
        onPasswordChange={workbench.setPassword}
        onRegisterNameChange={workbench.setRegisterName}
        onRegisterEmailChange={workbench.setRegisterEmail}
        onRegisterPasswordChange={workbench.setRegisterPassword}
        onLogin={workbench.login}
        onRegister={workbench.register}
      />
    );
  }

  const SidebarToggleIcon = workbench.sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const sidebarToggleLabel = workbench.sidebarCollapsed ? t("nav.expand") : t("nav.collapse");

  return (
    <div className={workbench.sidebarCollapsed ? "shell sidebar-collapsed" : "shell"}>
      <aside className="sidebar" aria-label={t("nav.primary")}>
        <div className="sidebar-top">
          <button type="button" className="brand" aria-label={t("nav.home")} title={t("nav.home")} onClick={() => workbench.setActive("overview")}>
            <span className="brand-mark" aria-hidden="true">K</span>
            <span className="brand-label" aria-hidden="true">
              <strong>UOK</strong>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarToggleLabel}
            aria-pressed={workbench.sidebarCollapsed}
            title={sidebarToggleLabel}
            onClick={() => workbench.setSidebarCollapsed((value) => !value)}
          >
            <SidebarToggleIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="nav-list">
          {sections.map((section) => {
            const Icon = section.icon;
            const label = t(`nav.${section.id}`, section.label);
            return (
              <button
                key={section.id}
                type="button"
                className={workbench.active === section.id ? "nav-item active" : "nav-item"}
                aria-label={label}
                aria-current={workbench.active === section.id ? "page" : undefined}
                title={workbench.sidebarCollapsed ? label : undefined}
                onClick={() => workbench.setActive(section.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="nav-label" aria-hidden="true">{label}</span>
              </button>
            );
          })}
        </nav>
        <AccountMenu
          user={workbench.currentUser}
          appearance={workbench.appearance}
          locale={workbench.locale}
          busy={workbench.busyAction === "refresh"}
          onAppearanceChange={workbench.setAppearance}
          onLocaleChange={workbench.setLocale}
          onRefresh={() => workbench.refresh()}
          onSignOut={() => workbench.clearSession()}
        />
      </aside>

      <main className="workbench">
        {workbench.active === "overview" && (
          <section className="content-grid" aria-label="Overview">
            <Pane title="Readiness" description="Release gates">
              <StatusRow label="Baseline readiness" ok={Boolean(workbench.alignment?.ok)} />
              <StatusRow label="Module-neutral core" ok={Boolean(workbench.alignment?.checks?.module_neutral_baseline)} />
              <StatusRow label="Baseline evidence" ok={Boolean(workbench.evidence?.ok)} />
            </Pane>
            <Pane title="Counts" description="Current organization">
              <MetricGrid counts={workbench.dashboard?.counts || {}} />
            </Pane>
          </section>
        )}

        {workbench.active === "apps" && (
          <AppsManagerPanel modules={workbench.moduleRows} busyAction={workbench.busyAction} onAction={workbench.moduleAction} />
        )}

        {renderModuleSurface(workbench.active, workbench)}

        {workbench.active === "evidence" && (
          <section aria-label="Evidence">
            <Pane title="Evidence" description="Baseline verification" wide>
              <JsonBlock value={workbench.evidence} />
            </Pane>
          </section>
        )}

        {workbench.active === "architecture" && (
          <section aria-label="Architecture">
            <Pane title="Architecture" description="Architecture alignment" wide>
              <JsonBlock value={workbench.alignment} />
            </Pane>
          </section>
        )}

      </main>
    </div>
  );
}
