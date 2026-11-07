import { useId, type InputHTMLAttributes } from "react";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  errors?: string[];
  help?: string;
}

export function FormField({ label, errors = [], help, ...input }: FormFieldProps) {
  const id = useId();
  const describedBy = errors.length > 0 ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={errors.length > 0} aria-describedby={describedBy} {...input} />
      {help && errors.length === 0 && (
        <p id={`${id}-help`} className="field__help">
          {help}
        </p>
      )}
      {errors.length > 0 && (
        <div id={`${id}-error`} className="field__error" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
