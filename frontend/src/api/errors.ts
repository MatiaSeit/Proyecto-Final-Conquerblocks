import { AxiosError } from "axios";
import type { ApiErrorBody } from "./types";

/** Turns whatever DRF sent back (detail string, field errors, or a network
 * failure) into one readable line for a banner. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.detail) return body.detail;
    if (body && typeof body === "object") {
      const firstField = Object.entries(body)[0];
      if (firstField) {
        const [field, messages] = firstField;
        const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
        return `${field}: ${text}`;
      }
    }
    if (error.response?.status === 0 || !error.response) {
      return "Can't reach the Alliance Supply Command API. Is the backend running?";
    }
  }
  return "Something went wrong. Try again.";
}
