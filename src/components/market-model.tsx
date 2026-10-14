"use client";
import { useState } from "react";
import { AssetPreview, PREVIEW_LIGHTING_PRESETS, type PreviewShading } from "@ekza/avatar-renderer/preview";
import { useLocale } from "./locale-provider";
import type { MarketItem } from "@/lib/market-types";

// Game conventions belong to the consumer, not the shared Ekza renderer.
const WILDSPARK_VARIANTS = [
  { id: "repeater", nodeName: "WildsparkSetRepeater", scale: 1 },
  { id: "launcher", nodeName: "WildsparkSetLauncher", scale: 1 },
] as const;

export default function MarketModel({ item }: { item: MarketItem }) {
  const { t } = useLocale();
  const [variant, setVariant] = useState("repeater");
  const [lighting, setLighting] = useState<keyof typeof PREVIEW_LIGHTING_PRESETS>("studio");
  const [shading, setShading] = useState<PreviewShading>("original");
  const [exposure, setExposure] = useState(1);
  const [rotate, setRotate] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const fallback = <div className="market-model-fallback">
    {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" />}
    <p role={state === "failed" ? "alert" : "status"}>
      {t(state === "failed" ? "3D preview unavailable. You can still view the cover and get this item." : "Loading 3D model…")}
    </p>
  </div>;
  return <>
    <div className="market-model-stage">
      <AssetPreview key={attempt} url={item.modelUrl} kind={item.kind === "avatar" ? "avatar" : "item"}
        integrity={{ sha256: item.sha256, sizeBytes: item.sizeBytes }}
        maxBytes={item.kind === "weapon" ? 8 * 1024 * 1024 : 64 * 1024 * 1024}
        embeddedOnly variants={item.wildspark ? WILDSPARK_VARIANTS : undefined}
        variant={item.wildspark ? variant : undefined} lighting={PREVIEW_LIGHTING_PRESETS[lighting]}
        shading={shading} exposure={exposure} toneMapping="aces" autoRotate={rotate}
        ariaLabel={t("3D preview of {name}").replace("{name}", item.name)}
        style={{ height: "100%", minHeight: 280 }} fallback={fallback} onStateChange={setState} />
    </div>
    {state === "failed" ? <button onClick={() => { setState("loading"); setAttempt(attempt + 1); }}>{t("Retry 3D preview")}</button> : null}
    <div className="market-model-controls">
      {item.wildspark && <div className="market-model-variants" role="group" aria-label={t("Weapon variant")}>
        {WILDSPARK_VARIANTS.map(({ id }) => <button key={id} aria-pressed={variant === id} onClick={() => setVariant(id)}>
          {t(id === "repeater" ? "Repeater" : "Launcher")}
        </button>)}
      </div>}
      <label>{t("Lighting")}<select aria-label={t("Lighting")} value={lighting} onChange={(e) => setLighting(e.target.value as typeof lighting)}>
        <option value="studio">{t("Studio light")}</option><option value="daylight">{t("Daylight")}</option><option value="dramatic">{t("Dramatic light")}</option>
      </select></label>
      <label>{t("Shading")}<select aria-label={t("Shading")} value={shading} onChange={(e) => setShading(e.target.value as PreviewShading)}>
        <option value="original">{t("Original materials")}</option><option value="clay">{t("Clay")}</option><option value="wireframe">{t("Wireframe")}</option>
      </select></label>
      <label>{t("Exposure")}<input aria-label={t("Exposure")} type="range" min="0.4" max="2" step="0.1" value={exposure} onChange={(e) => setExposure(Number(e.target.value))} /></label>
      <button aria-pressed={rotate} onClick={() => setRotate(!rotate)}>{t("Auto rotate")}</button>
      <button onClick={() => { setVariant("repeater"); setLighting("studio"); setShading("original"); setExposure(1); setRotate(false); setAttempt(attempt + 1); }}>{t("Reset view")}</button>
    </div>
    <p className="market-model-hint">{t("Drag to rotate · Scroll or pinch to zoom")}</p>
    <p className="market-model-hint">{t("Preview lighting may differ from the game.")}</p>
  </>;
}
