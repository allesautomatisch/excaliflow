import { useEffect, useState } from "react";
import clsx from "clsx";

import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { t } from "../i18n";

import type { LoadDialogDrawing, LoadDialogProject } from "../types";

import "./LoadDialog.scss";

const ALL_PROJECTS_VALUE = "__all__";
const NO_PROJECT_VALUE = "__none__";

type LoadDialogProps = {
  onCloseRequest: () => void;
  getLoadDialogDrawings?: (
    projectId?: string | null,
  ) => Promise<LoadDialogDrawing[]>;
  getLoadDialogProjects?: () => Promise<LoadDialogProject[]>;
  defaultProjectId?: string | null;
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
  getLoadDialogProjects,
  defaultProjectId,
  onLoadDrawing,
}: LoadDialogProps) => {
  const [projects, setProjects] = useState<LoadDialogProject[]>([]);
  const [projectErrorMessage, setProjectErrorMessage] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState(
    defaultProjectId ? String(defaultProjectId) : NO_PROJECT_VALUE,
  );
  const [drawings, setDrawings] = useState<LoadDialogDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "error" | "empty"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const selectedDrawing = drawings.find(
    (drawing) => drawing.id === selectedDrawingId,
  );
  const selectedProjectId =
    selectedProjectFilter === ALL_PROJECTS_VALUE
      ? undefined
      : selectedProjectFilter === NO_PROJECT_VALUE
      ? null
      : selectedProjectFilter;

  const getDrawingProjectName = (drawing: LoadDialogDrawing) => {
    if (drawing.project_id === null || drawing.project_id === undefined) {
      return "Kein Projekt";
    }

    const projectId = String(drawing.project_id);

    return (
      drawing.project_name?.trim() ||
      projects.find((project) => project.id === projectId)?.name ||
      "Unbekanntes Projekt"
    );
  };

  useEffect(() => {
    if (!getLoadDialogProjects) {
      return;
    }

    let isCancelled = false;

    const fetchProjects = async () => {
      setProjectErrorMessage("");

      try {
        const data = await getLoadDialogProjects();
        if (!isCancelled) {
          setProjects(data);
        }
      } catch (error: any) {
        console.error("Failed to load projects for load dialog", error);
        if (!isCancelled) {
          setProjectErrorMessage(
            error?.message || t("alerts.couldNotCreateShareableLink"),
          );
          setProjects([]);
        }
      }
    };

    fetchProjects();

    return () => {
      isCancelled = true;
    };
  }, [getLoadDialogProjects]);

  useEffect(() => {
    if (!getLoadDialogDrawings) {
      return;
    }

    let isCancelled = false;

    const fetchDrawings = async () => {
      setStatus("loading");
      setErrorMessage("");
      setSelectedDrawingId(null);

      try {
        const data = await getLoadDialogDrawings(selectedProjectId);
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
  }, [getLoadDialogDrawings, selectedProjectId]);

  return (
    <Dialog onCloseRequest={onCloseRequest} title={false}>
      <section className="LoadDialog">
        <header className="LoadDialog__header">
          <h2>{t("loadDialog.title")}</h2>
        </header>
        <div className="LoadDialog__content">
          <p className="LoadDialog__description">{t("loadDialog.content")}</p>

          <div className="LoadDialog__field">
            <label htmlFor="load-dialog-project">Projekt</label>
            <select
              id="load-dialog-project"
              value={selectedProjectFilter}
              onChange={(event) => setSelectedProjectFilter(event.target.value)}
            >
              <option value={ALL_PROJECTS_VALUE}>Alle</option>
              <option value={NO_PROJECT_VALUE}>Kein Projekt</option>
              {selectedProjectFilter !== ALL_PROJECTS_VALUE &&
                selectedProjectFilter !== NO_PROJECT_VALUE &&
                !projects.some(
                  (project) => project.id === selectedProjectFilter,
                ) && (
                  <option value={selectedProjectFilter}>
                    Unbekanntes Projekt
                  </option>
                )}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projectErrorMessage && (
              <p className="LoadDialog__fieldError">{projectErrorMessage}</p>
            )}
          </div>

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
                      <span className="LoadDialog__rowProject">
                        {getDrawingProjectName(drawing)}
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
            className="Card-button LoadDialog__loadButton"
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
