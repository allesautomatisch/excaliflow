import {
  DEFAULT_FLOWCHART_NODE_ICON_KEY,
  FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY,
  getFlowchartNodeIconKey,
} from "../flowchartNodeIcons";

describe("Flowchart node icon key resolution", () => {
  it("returns none when customData is missing", () => {
    expect(getFlowchartNodeIconKey({})).toBe(
      DEFAULT_FLOWCHART_NODE_ICON_KEY,
    );
  });

  it("returns none when customData is invalid", () => {
    expect(
      getFlowchartNodeIconKey({
        customData: {
          [FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY]: "manual",
        },
      }),
    ).toBe(DEFAULT_FLOWCHART_NODE_ICON_KEY);
  });

  it("returns automatic for valid values", () => {
    expect(
      getFlowchartNodeIconKey({
        customData: {
          [FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY]: "automatic",
        },
      }),
    ).toBe("automatic");
  });

  it("returns mail for valid values", () => {
    expect(
      getFlowchartNodeIconKey({
        customData: {
          [FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY]: "mail",
        },
      }),
    ).toBe("mail");
  });

  it("returns user for valid values", () => {
    expect(
      getFlowchartNodeIconKey({
        customData: {
          [FLOWCHART_NODE_ICON_CUSTOM_DATA_KEY]: "user",
        },
      }),
    ).toBe("user");
  });
});
