import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { useLogin } from "../hooks/useAuth";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const fieldErrors = login.error?.fieldErrors ?? {};

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <AuthLayout
      title="Welcome back"
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <FormField
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
          errors={fieldErrors.username}
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          errors={fieldErrors.password}
        />
        {login.error && !fieldErrors.username && !fieldErrors.password && (
          <p className="field__error" role="alert">
            {login.error.message}
          </p>
        )}
        <button type="submit" className="button button--wide" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
