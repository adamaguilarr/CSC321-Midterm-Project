import { useState, type FormEvent } from "react";
import { FormField } from "../components/FormField";
import { usePlayerSearch, useSendInvitation } from "../hooks/useInvitations";
import { toast } from "../stores/toastStore";
import type { Color } from "../types/api";

const COLOR_OPTIONS: { value: Color; label: string }[] = [
  { value: "red", label: "Red (moves first)" },
  { value: "white", label: "White" },
];
const SUGGESTIONS_ID = "player-suggestions";

export function NewGameContainer() {
  const [username, setUsername] = useState("");
  const [color, setColor] = useState<Color>("red");
  const send = useSendInvitation();
  const search = usePlayerSearch(username);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const invitee = username.trim();
    send.mutate(
      { invitee_username: invitee, inviter_color: color },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${invitee}.`);
          setUsername("");
        },
      },
    );
  };

  const fieldErrors = send.error?.fieldErrors ?? {};
  const formError = send.error && Object.keys(fieldErrors).length === 0 ? send.error.message : null;

  return (
    <form className="panel new-game" onSubmit={handleSubmit} noValidate>
      <h2 className="panel__title">Challenge a player</h2>
      <FormField
        label="Username"
        value={username}
        onChange={(event) => {
          setUsername(event.target.value);
          send.reset();
        }}
        list={SUGGESTIONS_ID}
        autoComplete="off"
        placeholder="Search players"
        errors={fieldErrors.invitee_username}
      />
      <datalist id={SUGGESTIONS_ID}>
        {search.data?.map((player) => (
          <option key={player.id} value={player.username} />
        ))}
      </datalist>
      <fieldset className="choices">
        <legend>You play</legend>
        {COLOR_OPTIONS.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="inviter_color"
              value={option.value}
              checked={color === option.value}
              onChange={() => setColor(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {formError && (
        <p className="field__error" role="alert">
          {formError}
        </p>
      )}
      <button type="submit" className="button" disabled={send.isPending || username.trim() === ""}>
        {send.isPending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
