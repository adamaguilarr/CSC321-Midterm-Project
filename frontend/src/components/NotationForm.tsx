import { useId, useState, type FormEvent } from "react";

interface NotationFormProps {
  disabled: boolean;
  /** Returns the reason the text can't be played, or null if it was accepted. */
  onSubmit: (notation: string) => string | null;
}

export function NotationForm({ disabled, onSubmit }: NotationFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim().toLowerCase();
    const problem = onSubmit(text);
    setError(problem);
    if (!problem) setValue("");
  };

  return (
    <form className="notation" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId}>Type a move</label>
      <div className="notation__row">
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="c3-d4 or c3xe5"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className="button" disabled={disabled || value.trim() === ""}>
          Play
        </button>
      </div>
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
