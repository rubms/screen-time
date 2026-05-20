import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders label", () => {
    render(<Button>Save rules</Button>);
    expect(screen.getByRole("button", { name: "Save rules" })).toBeInTheDocument();
  });
});
