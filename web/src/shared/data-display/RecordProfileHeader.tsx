import type { ReactNode } from "react";

export function RecordProfileHeader({
  avatar,
  title,
  subtitle,
  meta,
  actions,
  className
}: {
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className ? `record-profile-header ${className}` : "record-profile-header"}>
      <div className="record-profile-main">
        {avatar ? <div className="record-profile-avatar">{avatar}</div> : null}
        <div className="record-profile-copy">
          <div className="record-profile-title">{title}</div>
          {subtitle ? <div className="record-profile-subtitle">{subtitle}</div> : null}
          {meta ? <div className="record-profile-meta">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="record-profile-actions">{actions}</div> : null}
    </header>
  );
}
