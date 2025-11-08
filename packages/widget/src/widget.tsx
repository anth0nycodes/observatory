import { render } from "preact";
import { Draggable } from "@/components/draggable";
import {
  widgetDimensionsSignal,
  widgetExpandedSignal,
  widgetPositionSignal,
} from "@/state";
import Popover from "@/components/popover/popover";
import { syncTCCStore } from "@/hooks/useSyncTCCStore";
import { Logo } from "./assets/logo";

export function Widget() {
  syncTCCStore();

  return (
    <>
      <Draggable
        snapToCorner
        onClick={() =>
          (widgetExpandedSignal.value = !widgetExpandedSignal.value)
        }
        positionSignal={widgetPositionSignal}
        dimensionsSignal={widgetDimensionsSignal}
      >
        <Logo />
      </Draggable>
      {widgetExpandedSignal.value && <Popover />}
    </>
  );
}

export function createWidget(root: ShadowRoot): HTMLElement {
  const container = document.createElement("div");
  container.id = "tcc-widget-root";
  root.appendChild(container);

  render(<Widget />, container);

  return container;
}
