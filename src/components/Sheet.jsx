"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

// <dialog> as a bottom sheet. `modal` traps focus with a backdrop; without it the page stays usable.
export default function Sheet({
  open,
  onClose,
  title,
  titleId,
  closeLabel,
  modal = true,
  center = false,
  children,
}) {
  const ref = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) modal ? dialog.showModal() : dialog.show();
    if (!open && dialog.open) dialog.close();
  }, [open, modal]);

  // Drag the handle down to dismiss. Movement follows the finger; release past 90px closes.
  function start(event) {
    drag.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.y);
    ref.current.style.transition = "none";
    ref.current.style.translate = `0 ${drag.current.dy}px`;
  }
  function end() {
    if (!drag.current) return;
    const far = drag.current.dy > 90;
    drag.current = null;
    ref.current.style.transition = "";
    ref.current.style.translate = "";
    if (far) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`sheet${center ? " sheet-center" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (modal && event.target === ref.current) onClose();
      }}
    >
      <div
        className="flex touch-none justify-center pt-2.5 pb-1 md:hidden"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-hidden="true"
      >
        <span className="h-1.5 w-11 rounded-full bg-rule" />
      </div>
      <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6 md:pt-6">
        <div className="flex items-start gap-3">
          <h2 id={titleId} className="flex-1 text-xl font-extrabold tracking-[-0.015em]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-pencil hover:bg-wash hover:text-ink"
          >
            <Icon name="close" className="size-5" />
            <span className="sr-only">{closeLabel}</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
