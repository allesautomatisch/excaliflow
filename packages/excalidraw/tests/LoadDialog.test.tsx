import { vi } from "vitest";

import { Excalidraw } from "../index";

import { fireEvent, render, screen, waitFor, within } from "./test-utils";

const projects = [
  { id: "customer-a", name: "Kunde A" },
  { id: "strategy", name: "Strategie" },
  { id: "examples", name: "Beispiele" },
  { id: "automatic", name: "Alles Automatisch" },
  { id: "customer-b", name: "Kunde B" },
];

const setup = async (defaultProjectId?: string | null) => {
  const getDrawings = vi.fn().mockResolvedValue([]);
  await render(
    <Excalidraw
      initialData={{ appState: { openDialog: { name: "load" } } }}
      getLoadDialogProjects={async () => projects}
      getLoadDialogDrawings={getDrawings}
      defaultLoadDialogProjectId={defaultProjectId}
    />,
  );
  await waitFor(() => expect(getDrawings).toHaveBeenCalled());
  return { getDrawings, trigger: screen.getByLabelText("Projekt") };
};

describe("load dialog project categories", () => {
  it("orders the root projects and filters drawings by a customer selection", async () => {
    const { getDrawings, trigger } = await setup();
    expect(getDrawings).toHaveBeenLastCalledWith("automatic");
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Projekt" });
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual(["Kein Projekt", "Alles Automatisch", "Beispiele", "Strategie"]);
    expect(within(menu).queryByText("Kunde A")).toBeNull();

    fireEvent.pointerEnter(screen.getByRole("menuitem", { name: "Kunden" }), {
      pointerType: "mouse",
    });
    const submenu = await screen.findByRole("menu", { name: "Kunden" });
    expect(
      within(submenu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual(["Kunde A", "Kunde B"]);
    fireEvent.click(
      within(submenu).getByRole("menuitemradio", { name: "Kunde B" }),
    );
    await waitFor(() =>
      expect(getDrawings).toHaveBeenLastCalledWith("customer-b"),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveTextContent("Kunde B");
  });

  it("keeps an unassigned drawing selected and passes null for Kein Projekt", async () => {
    const { getDrawings, trigger } = await setup(null);
    expect(getDrawings).toHaveBeenLastCalledWith(null);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Beispiele" }));
    await waitFor(() =>
      expect(getDrawings).toHaveBeenLastCalledWith("examples"),
    );
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Kein Projekt" }),
    );
    await waitFor(() => expect(getDrawings).toHaveBeenLastCalledWith(null));
  });

  it("supports keyboard navigation and closes each menu before the dialog", async () => {
    const { trigger } = await setup("customer-b");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const customers = screen.getByRole("menuitem", { name: "Kunden" });
    await waitFor(() => expect(customers).toHaveFocus());
    fireEvent.keyDown(customers, { key: "ArrowRight" });
    const selected = await screen.findByRole("menuitemradio", {
      name: "Kunde B",
    });
    await waitFor(() => expect(selected).toHaveFocus());
    fireEvent.keyDown(selected, { key: "ArrowUp" });
    expect(
      screen.getByRole("menuitemradio", { name: "Kunde A" }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Kunden" })).toBeNull();
    expect(customers).toHaveFocus();
    fireEvent.keyDown(customers, { key: "ArrowRight" });
    await waitFor(() =>
      expect(
        screen.getByRole("menuitemradio", { name: "Kunde B" }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(screen.queryByRole("menu", { name: "Kunden" })).toBeNull();
    expect(customers).toHaveFocus();
    fireEvent.keyDown(customers, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.querySelector(".LoadDialog")).not.toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens the customer submenu on click", async () => {
    const { trigger } = await setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Kunden" }));
    expect(screen.getByRole("menu", { name: "Kunden" })).toBeVisible();
  });
});
