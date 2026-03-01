import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionToggleElementConceal } from "./actionElementConceal";

describe("actionElementConceal", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("conceals and reveals an arrow's text when connected node concealment changes", () => {
    const sourceNode = API.createElement({
      type: "rectangle",
      id: "node-source",
      x: 10,
      y: 10,
    });
    const targetNode = API.createElement({
      type: "rectangle",
      id: "node-target",
      x: 200,
      y: 10,
    });
    const [arrow, arrowLabel] = API.createLabeledArrow();

    API.setElements([sourceNode, targetNode, arrow, arrowLabel]);
    API.updateElement(arrow, {
      startBinding: {
        elementId: sourceNode.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
      endBinding: {
        elementId: targetNode.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    });

    API.setSelectedElements([sourceNode]);
    API.executeAction(actionToggleElementConceal);

    expect(API.getElement(sourceNode)).toMatchObject({
      concealed: true,
    });
    expect(API.getElement(arrow)).toMatchObject({
      concealed: true,
    });
    expect(API.getElement(arrowLabel)).toMatchObject({
      concealed: true,
    });

    API.executeAction(actionToggleElementConceal);

    expect(API.getElement(sourceNode)).toMatchObject({
      concealed: false,
    });
    expect(API.getElement(arrow)).toMatchObject({
      concealed: false,
    });
    expect(API.getElement(arrowLabel)).toMatchObject({
      concealed: false,
    });
  });
});
