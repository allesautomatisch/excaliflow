import * as Popover from "@radix-ui/react-popover";
import { useRef, useState } from "react";

import { useEditorInterface } from "./App";
import { checkIcon } from "./icons";

import type { KeyboardEvent } from "react";
import type { LoadDialogProject } from "../types";

const ROOT_PROJECT_NAMES = ["Alles Automatisch", "Beispiele", "Strategie"];

const navigateMenu = (event: KeyboardEvent<HTMLDivElement>) => {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)',
    ),
  );
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex: number;

  switch (event.key) {
    case "ArrowDown":
      nextIndex = (index + 1) % items.length;
      break;
    case "ArrowUp":
      nextIndex = (index - 1 + items.length) % items.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = items.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  event.stopPropagation();
  items[nextIndex]?.focus();
};

export const LoadDialogProjectPicker = ({
  projects,
  value,
  disabled,
  portalContainer,
  onChange,
}: {
  projects: LoadDialogProject[];
  value: string | null;
  disabled: boolean;
  portalContainer: HTMLElement | null;
  onChange: (value: string | null) => void;
}) => {
  const { formFactor } = useEditorInterface();
  const [open, setOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const customersRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const focusSubmenuRef = useRef(false);
  const rootProjects = ROOT_PROJECT_NAMES.flatMap((name) =>
    projects.filter((project) => project.name.trim() === name),
  );
  const customerProjects = projects.filter(
    (project) => !ROOT_PROJECT_NAMES.includes(project.name.trim()),
  );
  const selectedName =
    value === null
      ? "Kein Projekt"
      : projects.find((project) => project.id === value)?.name ||
        "Unbekanntes Projekt";

  const selectProject = (projectId: string | null) => {
    onChange(projectId);
    setOpen(false);
    setCustomersOpen(false);
  };

  const focusSubmenu = () => {
    (
      submenuRef.current?.querySelector<HTMLButtonElement>(
        '[aria-checked="true"]',
      ) ||
      submenuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"]',
      )
    )?.focus();
  };

  const renderProject = (id: string | null, name: string) => (
    <button
      key={id ?? "no-project"}
      type="button"
      role="menuitemradio"
      aria-checked={value === id}
      className="LoadDialog__projectOption"
      onClick={() => selectProject(id)}
    >
      <span className="LoadDialog__projectCheck" aria-hidden="true">
        {value === id && checkIcon}
      </span>
      <span>{name}</span>
    </button>
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setCustomersOpen(false);
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          id="load-dialog-project"
          type="button"
          className="LoadDialog__projectTrigger"
          disabled={disabled}
          aria-haspopup="menu"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span>{disabled ? "Lade Projekte…" : selectedName}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          ref={menuRef}
          role="menu"
          aria-label="Projekt"
          className="LoadDialog__projectMenu"
          align="start"
          sideOffset={4}
          collisionPadding={12}
          onKeyDown={navigateMenu}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (
              menuRef.current?.querySelector<HTMLButtonElement>(
                '[aria-checked="true"]',
              ) ||
              (customerProjects.length ? customersRef.current : null) ||
              menuRef.current?.querySelector<HTMLButtonElement>(
                '[role="menuitemradio"]',
              )
            )?.focus();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            setCustomersOpen(false);
          }}
        >
          <div onPointerEnter={() => setCustomersOpen(false)}>
            {renderProject(null, "Kein Projekt")}
            {rootProjects.map((project) =>
              renderProject(project.id, project.name),
            )}
          </div>
          <Popover.Root open={customersOpen} onOpenChange={setCustomersOpen}>
            <Popover.Trigger asChild>
              <button
                ref={customersRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                className="LoadDialog__projectOption LoadDialog__customerTrigger"
                disabled={!customerProjects.length}
                onPointerEnter={(event) => {
                  if (
                    event.pointerType === "mouse" &&
                    customerProjects.length
                  ) {
                    setCustomersOpen(true);
                  }
                }}
                onClick={(event) => {
                  event.preventDefault();
                  setCustomersOpen(true);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "ArrowRight" ||
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    focusSubmenuRef.current = !customersOpen;
                    setCustomersOpen(true);
                    focusSubmenu();
                  }
                }}
              >
                <span className="LoadDialog__projectCheck" aria-hidden="true">
                  {customerProjects.some((project) => project.id === value) &&
                    checkIcon}
                </span>
                <span>Kunden</span>
                <span className="LoadDialog__submenuArrow" aria-hidden="true">
                  ›
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal container={portalContainer}>
              <Popover.Content
                ref={submenuRef}
                role="menu"
                aria-label="Kunden"
                className="LoadDialog__projectMenu LoadDialog__projectSubmenu"
                side={formFactor === "phone" ? "bottom" : "right"}
                align="start"
                sideOffset={2}
                collisionPadding={12}
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  if (focusSubmenuRef.current) {
                    focusSubmenu();
                    focusSubmenuRef.current = false;
                  }
                }}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    event.stopPropagation();
                    setCustomersOpen(false);
                    customersRef.current?.focus();
                  } else {
                    navigateMenu(event);
                  }
                }}
                onEscapeKeyDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCustomersOpen(false);
                  customersRef.current?.focus();
                }}
              >
                {customerProjects.map((project) =>
                  renderProject(project.id, project.name),
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
