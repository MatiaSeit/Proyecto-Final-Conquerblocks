import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./errors";

function makeAxiosError(data: unknown, status = 400): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = {
    data,
    status,
    statusText: "",
    headers: {},
    config: {},
  } as AxiosResponse;
  return error;
}

describe("extractErrorMessage", () => {
  it("prefers a DRF 'detail' message when the API sends one", () => {
    const error = makeAxiosError({ detail: "Not enough stock available." });
    expect(extractErrorMessage(error)).toBe("Not enough stock available.");
  });

  it("falls back to the first field error when there's no 'detail'", () => {
    const error = makeAxiosError({ quantity: ["Must be greater than zero."] });
    expect(extractErrorMessage(error)).toBe("quantity: Must be greater than zero.");
  });

  it("joins multiple messages for the same field", () => {
    const error = makeAxiosError({ number: ["This field is required.", "Must be unique."] });
    expect(extractErrorMessage(error)).toBe("number: This field is required. Must be unique.");
  });

  it("reports the backend as unreachable when there's no response at all (network down)", () => {
    const error = new AxiosError("Network Error");
    expect(extractErrorMessage(error)).toMatch(/Can't reach the Alliance Supply Command API/);
  });

  it("gives a generic message for anything that isn't an Axios error", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("Something went wrong. Try again.");
    expect(extractErrorMessage("boom")).toBe("Something went wrong. Try again.");
  });
});
