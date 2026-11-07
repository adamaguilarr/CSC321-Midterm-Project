import "@tanstack/react-query";
import type { ApiError } from "../api/errors";

declare module "@tanstack/react-query" {
  interface Register {
    /** The Axios interceptor guarantees that every API failure is an ApiError. */
    defaultError: ApiError;
    mutationMeta: {
      /** The caller shows this mutation's errors itself, so skip the global toast. */
      inlineErrors?: boolean;
    };
  }
}
