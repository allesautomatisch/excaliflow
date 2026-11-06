import {
  getFeatureFlag,
  KEYS,
  reseed,
  resolvablePromise,
  setFeatureFlag,
} from "@excalidraw/common";

import { Excalidraw } from "@excalidraw/excalidraw";
import { isElbowArrow, isTextElement } from "@excalidraw/element/typeChecks";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  createEvent,
  fireEvent,
  renderApp as render,
  unmountComponent,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");
const modifierKey = KEYS.CTRL_OR_CMD === "metaKey" ? "Meta" : "Control";

// Excaliflow now starts bound-text editing when keyboard-created nodes commit.
// Finish the empty edit so this suite can keep testing creation/navigation.
const diagramElements = () =>
  h.elements.filter((el) => !el.isDeleted && el.type !== "text");
const commitFlow = async () => {
  Keyboard.keyUp(modifierKey);
  if (h.state.editingTextElement && isTextElement(h.state.editingTextElement)) {
    const containerId = h.state.editingTextElement.containerId;
    Keyboard.exitTextEditor(await getTextEditor());
    await waitFor(() => expect(h.state.editingTextElement).toBe(null));
    const created = diagramElements().find((el) => el.id === containerId);
    if (created) {
      API.setSelectedElements([created]);
    }
  }
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();

  unmountComponent();
  const ready = resolvablePromise<ExcalidrawImperativeAPI>();
  await render(
    <Excalidraw
      handleKeyboardGlobally={true}
      excalidrawAPI={(api) => ready.resolve(api)}
    />,
  );
  const api = await ready;
  await waitFor(() => expect(api.getAppState().isLoading).toBe(false));
  h.state.width = 1000;
  h.state.height = 1000;

  // The bounds of hand-drawn linear elements may change after flipping, so
  // removing this style for testing
  UI.clickTool("arrow");
  UI.clickByTitle("Architect");
  UI.clickTool("selection");
});

describe("flow chart creation", () => {
  beforeEach(() => {
    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 120,
      height: 120,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
  });

  it("selects the new node when Enter finishes its empty text edit", async () => {
    const bpdFeatures = getFeatureFlag("BPD_FEATURES");
    setFeatureFlag("BPD_FEATURES", true);
    try {
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ARROW_RIGHT);
      });
      Keyboard.keyUp(modifierKey);

      const editor = await getTextEditor();
      const arrow = diagramElements().find(isElbowArrow);
      const newNodeId = arrow?.endBinding?.elementId;
      expect(newNodeId).toBeDefined();
      expect(editor.value).toBe("");

      Keyboard.keyPress(KEYS.ENTER, editor);

      expect(h.state.editingTextElement).toBeNull();
      expect(Object.keys(h.state.selectedElementIds)).toEqual([newNodeId]);
      expect(
        h.elements.filter((el) => !el.isDeleted && isTextElement(el)),
      ).toEqual([]);
    } finally {
      setFeatureFlag("BPD_FEATURES", bpdFeatures);
    }
  });

  it.each([300, 301])(
    "uses the Shift release grace period when committing after %i ms",
    (delay) => {
      const originalNode = diagramElements()[0];
      const creator = h.app.flowChartCreator;

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ARROW_RIGHT);
      });
      const forward = creator.pendingNodes?.find(isElbowArrow);
      expect(forward?.startBinding?.elementId).toBe(originalNode.id);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown("Shift");
      });
      const reversed = creator.pendingNodes?.find(isElbowArrow);
      expect(reversed?.id).toBe(forward?.id);
      expect(reversed?.startBinding).toEqual(forward?.endBinding);
      expect(reversed?.endBinding).toEqual(forward?.startBinding);
      expect(reversed?.endArrowhead).toBe("triangle");

      const shiftUp = createEvent.keyUp(document, {
        key: "Shift",
        [KEYS.CTRL_OR_CMD]: true,
      });
      fireEvent(document, shiftUp);
      expect(creator.pendingNodes?.find(isElbowArrow)).toEqual(forward);
      expect(diagramElements()).toHaveLength(1);

      const modifierUp = createEvent.keyUp(document, { key: modifierKey });
      Object.defineProperty(modifierUp, "timeStamp", {
        value: shiftUp.timeStamp + delay,
      });
      fireEvent(document, modifierUp);

      expect(diagramElements()).toHaveLength(3);
      const arrow = diagramElements().find(isElbowArrow);
      expect(arrow?.startBinding).toEqual(
        delay === 300 ? forward?.endBinding : forward?.startBinding,
      );
      expect(arrow?.endBinding).toEqual(
        delay === 300 ? forward?.startBinding : forward?.endBinding,
      );
    },
  );

  it.each([false, true])(
    "creates from the node text editor with Shift held = %s",
    async (shiftKey) => {
      const originalNode = diagramElements()[0];
      Keyboard.keyPress(KEYS.ENTER);
      const editor = await getTextEditor();
      fireEvent.input(editor, { target: { value: "Review request" } });

      fireEvent.keyDown(editor, { key: KEYS.ARROW_RIGHT });
      expect(document.activeElement).toBe(editor);
      expect(h.app.flowChartCreator.pendingNodes).toBeNull();

      fireEvent.keyDown(editor, {
        key: KEYS.ARROW_RIGHT,
        [KEYS.CTRL_OR_CMD]: true,
        shiftKey,
      });
      expect(h.state.editingTextElement).toBeNull();
      expect(diagramElements()).toHaveLength(1);

      fireEvent.keyUp(document, { key: modifierKey, shiftKey });
      const newNode = diagramElements().find(
        (element) =>
          element.type === "rectangle" && element.id !== originalNode.id,
      );
      const arrow = diagramElements().find(isElbowArrow);
      expect(newNode?.x).toBeGreaterThan(originalNode.x);
      expect(arrow?.startBinding?.elementId).toBe(
        shiftKey ? newNode?.id : originalNode.id,
      );
      expect(arrow?.endBinding?.elementId).toBe(
        shiftKey ? originalNode.id : newNode?.id,
      );
      expect(
        h.elements.find(
          (el) => isTextElement(el) && el.containerId === originalNode.id,
        ),
      ).toMatchObject({ originalText: "Review request", isDeleted: false });
      expect(h.state.editingTextElement).toMatchObject({
        containerId: newNode?.id,
      });
      expect(await getTextEditor()).toBe(document.activeElement);
    },
  );

  // multiple at once
  it("create multiple successor nodes at once", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    await commitFlow();

    expect(diagramElements().length).toBe(5);
    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(3);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      2,
    );
  });

  it("when directions are changed, only the last same directions will apply", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);

      Keyboard.keyPress(KEYS.ARROW_LEFT);

      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    await commitFlow();

    expect(diagramElements().length).toBe(7);
    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(4);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      3,
    );
  });

  it("when escaped, no nodes will be created", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    Keyboard.keyPress(KEYS.ESCAPE);
    await commitFlow();

    expect(diagramElements().length).toBe(1);
  });

  it("create nodes one at a time", async () => {
    const initialNode = diagramElements()[0];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    expect(diagramElements().length).toBe(3);
    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(2);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      1,
    );

    const firstChildNode = diagramElements().filter(
      (el) => el.type === "rectangle" && el.id !== initialNode.id,
    )[0];
    expect(firstChildNode).not.toBe(null);
    expect(firstChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    expect(diagramElements().length).toBe(5);
    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(3);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      2,
    );

    const secondChildNode = diagramElements().filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id,
    )[0];
    expect(secondChildNode).not.toBe(null);
    expect(secondChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    expect(diagramElements().length).toBe(7);
    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(4);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      3,
    );

    const thirdChildNode = diagramElements().filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id &&
        el.id !== secondChildNode.id,
    )[0];

    expect(thirdChildNode).not.toBe(null);
    expect(thirdChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    expect(firstChildNode.x).toBe(secondChildNode.x);
    expect(secondChildNode.x).toBe(thirdChildNode.x);
  });
});

describe("flow chart navigation", () => {
  it("single node at each level", async () => {
    /**
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    expect(
      diagramElements().filter((el) => el.type === "rectangle").length,
    ).toBe(5);
    expect(diagramElements().filter((el) => el.type === "arrow").length).toBe(
      4,
    );

    // all the way to the left, gets us to the first node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // all the way to the right, gets us to the last node
    const rightMostNode = diagramElements()[diagramElements().length - 2];
    expect(rightMostNode);
    expect(rightMostNode.type).toBe("rectangle");
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);
  });

  it("multiple nodes at each level", async () => {
    /**
     * from the perspective of the first node, there're four layers, and
     * there are four nodes at the second layer
     *
     *   -> ▨
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     *   -> ▨
     *   -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    const secondNode = diagramElements()[1];
    const rightMostNode = diagramElements()[diagramElements().length - 2];

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    API.setSelectedElements([rectangle]);

    // because of same level cycling,
    // going right five times should take us back to the second node again
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[secondNode.id]).toBe(true);

    // from the second node, going right three times should take us to the rightmost node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("take the most obvious link when possible", async () => {
    /**
     * ▨ → ▨   ▨ → ▨
     *     ↓   ↑
     *     ▨ → ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    await commitFlow();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    await commitFlow();

    // last node should be the one that's selected
    const rightMostNode = diagramElements()[diagramElements().length - 2];
    expect(rightMostNode.type).toBe("rectangle");
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);

    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // going any direction takes us to the predecessor as well
    const predecessorToRightMostNode =
      diagramElements()[diagramElements().length - 4];
    expect(predecessorToRightMostNode.type).toBe("rectangle");

    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
    API.setSelectedElements([rightMostNode]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).not.toBe(true);
    expect(h.state.selectedElementIds[predecessorToRightMostNode.id]).toBe(
      true,
    );
  });
});
