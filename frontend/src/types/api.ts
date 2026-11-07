/** Wire types for the Django API. Every field mirrors a DRF serializer. */

export type Color = "red" | "white";
export type GameStatus = "active" | "completed";
export type EndReason = "" | "no_moves" | "resignation" | "draw_rule";
export type InvitationStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface UserSummary {
  id: number;
  username: string;
}

export interface PlayerRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface CurrentUser extends UserSummary {
  email: string;
  profile: PlayerRecord;
}

export interface AuthSession {
  token: string;
  user: CurrentUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  email?: string;
}

export interface Seat extends UserSummary {
  color: Color;
}

export interface MoveRecord {
  number: number;
  color: Color;
  player: string;
  notation: string;
  captured_count: number;
  crowned: boolean;
  created_at: string;
}

export interface GameSummary {
  id: number;
  status: GameStatus;
  current_turn: Color;
  players: Seat[];
  winner: UserSummary | null;
  end_reason: EndReason;
  move_count: number;
  your_color: Color | null;
  is_your_turn: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameDetail extends GameSummary {
  /** board[row][col] holds a piece code. See game/engine.ts. */
  board: number[][];
  moves: MoveRecord[];
}

export interface Invitation {
  id: number;
  inviter: UserSummary;
  invitee: UserSummary;
  inviter_color: Color;
  status: InvitationStatus;
  game: number | null;
  created_at: string;
  responded_at: string | null;
}

export interface InvitationPayload {
  invitee_username: string;
  inviter_color: Color;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** The backend's single error shape. See backend/config/exceptions.py. */
export interface ApiErrorBody {
  code: string;
  detail: string;
  errors?: Record<string, string[]>;
}
