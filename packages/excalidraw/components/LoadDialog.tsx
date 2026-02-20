import { useEffect, useState } from "react";
import clsx from "clsx";

import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { t } from "../i18n";

import type { LoadDialogDrawing } from "../types";

import "./LoadDialog.scss";

type LoadDialogProps = {
  onCloseRequest: () => void;
  getLoadDialogDrawings?: () => Promise<LoadDialogDrawing[]>;
  onLoadDrawing?: (drawing: LoadDialogDrawing) => Promise<void> | void;
};

const formatDrawingUpdatedAt = (updatedAt: string) => {
  const parsedDate = new Date(updatedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return updatedAt;
  }
  return parsedDate.toLocaleString();
};

export const LoadDialog = ({
  onCloseRequest,
  getLoadDialogDrawings,
  onLoadDrawing,
}: LoadDialogProps) => {
  const [drawings, setDrawings] = useState<LoadDialogDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "error" | "empty"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const selectedDrawing = drawings.find(
    (drawing) => drawing.id === selectedDrawingId,
  );

  useEffect(() => {
    if (!getLoadDialogDrawings) {
      return;
    }

    let isCancelled = false;

    const fetchDrawings = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const data = await getLoadDialogDrawings();
        if (!isCancelled) {
          setDrawings(data);
          setStatus(data.length ? "loaded" : "empty");
        }
      } catch (error: any) {
        console.error("Failed to load drawings for load dialog", error);
        if (!isCancelled) {
          setStatus("error");
          setErrorMessage(
            error?.message || t("alerts.couldNotCreateShareableLink"),
          );
          setDrawings([]);
        }
      }
    };

    fetchDrawings();

    return () => {
      isCancelled = true;
    };
  }, [getLoadDialogDrawings]);

  return (
    <Dialog onCloseRequest={onCloseRequest} title={false}>
      <section className="LoadDialog">
        <header className="LoadDialog__header">
          <h2>{t("loadDialog.title")}</h2>
        </header>
        <div className="LoadDialog__content">
          <p className="LoadDialog__description">{t("loadDialog.content")}</p>

          {status === "loading" && (
            <p className="LoadDialog__status">{t("labels.loadingScene")}</p>
          )}

          {status === "error" && (
            <p className="LoadDialog__status LoadDialog__status--error">
              {errorMessage}
            </p>
          )}

          {status === "empty" && (
            <p className="LoadDialog__status">{t("loadDialog.empty")}</p>
          )}

          {status === "loaded" && (
            <ul className="LoadDialog__list">
              {drawings.map((drawing) => {
                const isSelected = selectedDrawingId === drawing.id;
                return (
                  <li key={drawing.id} className="LoadDialog__rowWrap">
                    <button
                      type="button"
                      className={clsx("LoadDialog__row", {
                        "LoadDialog__row--selected": isSelected,
                      })}
                      onClick={() => setSelectedDrawingId(drawing.id)}
                      aria-selected={isSelected}
                    >
                      <span className="LoadDialog__rowName">
                        {drawing.name || t("labels.untitled")}
                      </span>
                      <span className="LoadDialog__rowUpdated">
                        {formatDrawingUpdatedAt(drawing.updated_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="LoadDialog__footer">
          <ToolButton
            type="button"
            className="Card-button"
            aria-label={t("loadDialog.load")}
            title={t("loadDialog.load")}
            disabled={!selectedDrawing || !onLoadDrawing}
            showAriaLabel={true}
            onClick={async () => {
              if (selectedDrawing) {
                await onLoadDrawing?.(selectedDrawing);
              }
            }}
          />
        </footer>
      </section>
    </Dialog>
  );
};
