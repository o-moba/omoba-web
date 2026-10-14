"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "./locale-provider";
import type { MarketItem } from "@/lib/market-types";

// Neither Three.js nor model bytes load until someone opens a preview.
const MarketModel = dynamic(() => import("./market-model"), { ssr: false });

export default function MarketPreviewDialog({ item, onClose }: { item: MarketItem; onClose: () => void }) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="market-model-dialog" aria-labelledby="market-model-title" onCancel={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    } }}>
    <header><div><span className="creator-overline">{t("3D PREVIEW")}</span><h2 id="market-model-title">{item.name}</h2></div>
      <button autoFocus onClick={onClose} aria-label={t("Close 3D preview")}>✕</button>
    </header>
    <MarketModel item={item} />
  </dialog>;
}
