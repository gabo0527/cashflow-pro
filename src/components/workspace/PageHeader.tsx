import React from "react";
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  context,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  context?: React.ReactNode;
}) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-page-heading">
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h1>
          {title}
          <span aria-hidden="true">.</span>
        </h1>
        {description && (
          <div className="workspace-page-description">{description}</div>
        )}
      </div>
      {(actions || context) && (
        <div className="workspace-page-tools">
          {context && <div className="workspace-page-context">{context}</div>}
          {actions && <div className="workspace-page-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
