import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { FormField } from "../components/FormField";
import { useRegister } from "../hooks/useAuth";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const register = useRegister();
  const fieldErrors = register.error?.fieldErrors ?? {};

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    register.mutate({ username, password, ...(email ? { email } : {}) });
  };

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <AuthLayout
      title="Take a seat"
      footer={
        <>
          Already playing? <Link to="/login">Log in</Link>
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
          label="Email (optional)"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          errors={fieldErrors.email}
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          help="At least 8 characters, and not a common password."
          errors={fieldErrors.password}
        />
        <FormField
          label="Confirm password"
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          required
          errors={mismatch ? ["The passwords don't match."] : undefined}
        />
        {register.error && !hasFieldErrors && (
          <p className="field__error" role="alert">
            {register.error.message}
          </p>
        )}
        <button type="submit" className="button button--wide" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
