import type { JSX } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { cn } from "@/utils/cn";
import { getClosestCorner, getNewCornerPosition } from "@/utils/corners";
import { Signal } from "@preact/signals";
import { widgetCornerSignal } from "@/state";

const animateDraggableElement = (
  draggableElement: HTMLDivElement,
  x: number,
  y: number
) => {
  requestAnimationFrame(() => {
    draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
};

export function Draggable({
  snapToCorner,
  children,
  className,
  onClick,
  positionSignal,
  dimensionsSignal,
  ...props
}: {
  snapToCorner?: boolean;
  children: JSX.Element;
  className?: string;
  onClick?: () => void;
  positionSignal: Signal<{ x: number; y: number }>;
  dimensionsSignal: Signal<{ width: number; height: number }>;
} & JSX.IntrinsicElements["div"]) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((e: globalThis.PointerEvent) => {
    e.preventDefault();

    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    // if element was already being dragged, stop the animation
    if (draggableElement.style.transition) {
      draggableElement.style.transition = "none";
    }

    const { clientX: initialMouseX, clientY: initialMouseY } = e;
    const { left: draggableElementX, top: draggableElementY } =
      draggableElement.getBoundingClientRect();

    // used to prevent user from dragging widget outside of window
    const minimumX = window.innerWidth - draggableElement.offsetWidth;
    const minimumY = window.innerHeight - draggableElement.offsetHeight;

    // keep track of final position so we know which corner to snap to
    let finalX = initialMouseX;
    let finalY = initialMouseY;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const { clientX: currentMouseX, clientY: currentMouseY } = e;

      finalX = currentMouseX;
      finalY = currentMouseY;

      requestAnimationFrame(() => {
        const changeInMouseX = currentMouseX - initialMouseX;
        const changeInMouseY = currentMouseY - initialMouseY;

        const isOutsideWindowX =
          currentMouseX < 0 || currentMouseX > window.innerWidth;
        const isOutsideWindowY =
          currentMouseY < 0 || currentMouseY > window.innerHeight;

        if (isOutsideWindowX || isOutsideWindowY) {
          handlePointerUp();
          return;
        }

        const x = Math.max(
          0,
          Math.min(draggableElementX + changeInMouseX, minimumX)
        );
        const y = Math.max(
          0,
          Math.min(draggableElementY + changeInMouseY, minimumY)
        );

        draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        positionSignal.value = { x, y };
      });
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);

      const deltaX = finalX - initialMouseX;
      const deltaY = finalY - initialMouseY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 3) {
        onClick?.();
      }

      if (snapToCorner) {
        const closestCorner = getClosestCorner({
          x: finalX,
          y: finalY,
        });

        const onTransitionEnd = () => {
          draggableElement.style.transition = "none";
          draggableElement.removeEventListener(
            "transitionend",
            onTransitionEnd
          );
        };

        draggableElement.addEventListener("transitionend", onTransitionEnd);
        draggableElement.style.transition =
          "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

        const newCornerPosition = getNewCornerPosition({
          corner: closestCorner,
          elementWidth: draggableElement.offsetWidth,
          elementHeight: draggableElement.offsetHeight,
        });

        animateDraggableElement(
          draggableElement,
          newCornerPosition.x,
          newCornerPosition.y
        );
        widgetCornerSignal.value = closestCorner;
        positionSignal.value = {
          x: newCornerPosition.x,
          y: newCornerPosition.y,
        };
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  }, []);

  useEffect(() => {
    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    const handleWindowResize = () => {
      const currentCorner = getClosestCorner({
        x: draggableElement.getBoundingClientRect().left,
        y: draggableElement.getBoundingClientRect().top,
      });

      if (snapToCorner) {
        const newCornerPosition = getNewCornerPosition({
          corner: currentCorner,
          elementWidth: draggableElement.offsetWidth,
          elementHeight: draggableElement.offsetHeight,
        });

        const onTransitionEnd = () => {
          draggableElement.style.transition = "none";
          draggableElement.removeEventListener(
            "transitionend",
            onTransitionEnd
          );
        };

        draggableElement.addEventListener("transitionend", onTransitionEnd);
        draggableElement.style.transition =
          "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

        animateDraggableElement(
          draggableElement,
          newCornerPosition.x,
          newCornerPosition.y
        );
        widgetCornerSignal.value = currentCorner;
        positionSignal.value = {
          x: newCornerPosition.x,
          y: newCornerPosition.y,
        };
      }
    };

    window.addEventListener("resize", handleWindowResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  useLayoutEffect(() => {
    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    const { x, y } = getNewCornerPosition({
      corner: "top-right",
      elementWidth: draggableElement.offsetWidth,
      elementHeight: draggableElement.offsetHeight,
    });

    draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // populate initial signal values that Popover relies on
    positionSignal.value = { x, y };
    dimensionsSignal.value = {
      width: draggableElement.offsetWidth,
      height: draggableElement.offsetHeight,
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[1000]",
        "rounded-full",
        "select-none w-fit h-fit",
        "flex items-center justify-center",
        "bg-white border shadow-sm border-gray-200",
        "cursor-pointer hover:bg-gray-100",
        "touch-none",
        className
      )}
      onPointerDown={handleDrag}
      {...props}
    >
      {children}
    </div>
  );
}
