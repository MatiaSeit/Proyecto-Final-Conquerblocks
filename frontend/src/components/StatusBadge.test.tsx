import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text and a matching lowercase status class", () => {
    render(<StatusBadge status="DISPATCHED" />);
    expect(screen.getByText("DISPATCHED")).toHaveClass("status-dispatched");
  });

  it("stays in sync with whatever status string it's given", () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText("DRAFT")).toHaveClass("status-draft");
  });
});
