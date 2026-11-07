import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, footer, children }: AuthLayoutProps) {
  return (
    <main className="auth">
      <div className="auth__intro">
        <p className="brand brand--large">Slowboard</p>
        <p className="auth__tagline">Checkers by correspondence. Move when it suits you.</p>
      </div>
      <div className="auth__card">
        <h1>{title}</h1>
        {children}
        <p className="auth__footer">{footer}</p>
      </div>
    </main>
  );
}
