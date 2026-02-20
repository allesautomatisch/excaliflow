import {
  compressData,
  decompressData,
} from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  generateEncryptionKey,
  IV_LENGTH_BYTES,
} from "@excalidraw/excalidraw/data/encryption";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { isInvisiblySmallElement } from "@excalidraw/element";
import { t } from "@excalidraw/excalidraw/i18n";
import { bytesToHexString } from "@excalidraw/common";

import type { UserIdleState } from "@excalidraw/common";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { SceneBounds } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  SocketId,
} from "@excalidraw/excalidraw/types";
import type { MakeBrand } from "@excalidraw/common/utility-types";

import {
  DELETED_ELEMENT_TIMEOUT,
  ROOM_ID_BYTES,
} from "../app_constants";

import type { WS_SUBTYPES } from "../app_constants";

export type SyncableExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"SyncableExcalidrawElement">;

export const isSyncableElement = (
  element: OrderedExcalidrawElement,
): element is SyncableExcalidrawElement => {
  if (element.isDeleted) {
    if (element.updated > Date.now() - DELETED_ELEMENT_TIMEOUT) {
      return true;
    }
    return false;
  }
  return !isInvisiblySmallElement(element);
};

export const getSyncableElements = (
  elements: readonly OrderedExcalidrawElement[],
) =>
  elements.filter((element) =>
    isSyncableElement(element),
  ) as SyncableExcalidrawElement[];

const BACKEND_V2_GET = import.meta.env.VITE_APP_BACKEND_V2_GET_URL;
const BACKEND_V2_POST = import.meta.env.VITE_APP_BACKEND_V2_POST_URL;
const BACKEND_V2_ENCRYPTION_KEY =
  import.meta.env.VITE_APP_BACKEND_V2_ENCRYPTION_KEY?.trim() || "";

const generateRoomId = async () => {
  const buffer = new Uint8Array(ROOM_ID_BYTES);
  window.crypto.getRandomValues(buffer);
  return bytesToHexString(buffer);
};

const resolveBackendEncryptionKey = async () => {
  if (BACKEND_V2_ENCRYPTION_KEY) {
    return BACKEND_V2_ENCRYPTION_KEY;
  }
  return generateEncryptionKey("string");
};

export type EncryptedData = {
  data: ArrayBuffer;
  iv: Uint8Array;
};

export type SocketUpdateDataSource = {
  INVALID_RESPONSE: {
    type: WS_SUBTYPES.INVALID_RESPONSE;
  };
  SCENE_INIT: {
    type: WS_SUBTYPES.INIT;
    payload: {
      elements: readonly OrderedExcalidrawElement[];
    };
  };
  SCENE_UPDATE: {
    type: WS_SUBTYPES.UPDATE;
    payload: {
      elements: readonly OrderedExcalidrawElement[];
    };
  };
  MOUSE_LOCATION: {
    type: WS_SUBTYPES.MOUSE_LOCATION;
    payload: {
      socketId: SocketId;
      pointer: { x: number; y: number; tool: "pointer" | "laser" };
      button: "down" | "up";
      selectedElementIds: AppState["selectedElementIds"];
      username: string;
    };
  };
  USER_VISIBLE_SCENE_BOUNDS: {
    type: WS_SUBTYPES.USER_VISIBLE_SCENE_BOUNDS;
    payload: {
      socketId: SocketId;
      username: string;
      sceneBounds: SceneBounds;
    };
  };
  IDLE_STATUS: {
    type: WS_SUBTYPES.IDLE_STATUS;
    payload: {
      socketId: SocketId;
      userState: UserIdleState;
      username: string;
    };
  };
};

export type SocketUpdateDataIncoming =
  SocketUpdateDataSource[keyof SocketUpdateDataSource];

export type SocketUpdateData =
  SocketUpdateDataSource[keyof SocketUpdateDataSource] & {
    _brand: "socketUpdateData";
  };

const RE_COLLAB_LINK = /^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/;

export const isCollaborationLink = (link: string) => {
  const hash = new URL(link).hash;
  return RE_COLLAB_LINK.test(hash);
};

export const getCollaborationLinkData = (link: string) => {
  const hash = new URL(link).hash;
  const match = hash.match(RE_COLLAB_LINK);
  if (match && match[2].length !== 22) {
    window.alert(t("alerts.invalidEncryptionKey"));
    return null;
  }
  return match ? { roomId: match[1], roomKey: match[2] } : null;
};

export const generateCollaborationLinkData = async () => {
  const roomId = await generateRoomId();
  const roomKey = await generateEncryptionKey();

  if (!roomKey) {
    throw new Error("Couldn't generate room key");
  }

  return { roomId, roomKey };
};

export const getCollaborationLink = (data: {
  roomId: string;
  roomKey: string;
}) => {
  return `${window.location.origin}${window.location.pathname}#room=${data.roomId},${data.roomKey}`;
};

/**
 * Decodes shareLink data using the legacy buffer format.
 * @deprecated
 */
const legacy_decodeFromBackend = async ({
  buffer,
  decryptionKey,
}: {
  buffer: ArrayBuffer;
  decryptionKey: string;
}) => {
  let decrypted: ArrayBuffer;

  try {
    // Buffer should contain both the IV (fixed length) and encrypted data
    const iv = buffer.slice(0, IV_LENGTH_BYTES);
    const encrypted = buffer.slice(IV_LENGTH_BYTES, buffer.byteLength);
    decrypted = await decryptData(new Uint8Array(iv), encrypted, decryptionKey);
  } catch (error: any) {
    // Fixed IV (old format, backward compatibility)
    const fixedIv = new Uint8Array(IV_LENGTH_BYTES);
    decrypted = await decryptData(fixedIv, buffer, decryptionKey);
  }

  // We need to convert the decrypted array buffer to a string
  const string = new window.TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  const data: ImportedDataState = JSON.parse(string);

  return {
    elements: data.elements || null,
    appState: data.appState || null,
  };
};

export const importFromBackend = async (
  id: string,
  decryptionKey: string,
): Promise<ImportedDataState> => {
  try {
    const response = await fetch(`${BACKEND_V2_GET}${id}`);

    if (!response.ok) {
      window.alert(t("alerts.importBackendFailed"));
      return {};
    }
    const buffer = await response.arrayBuffer();

    try {
      const { data: decodedBuffer } = await decompressData(
        new Uint8Array(buffer),
        {
          decryptionKey,
        },
      );
      const data: ImportedDataState = JSON.parse(
        new TextDecoder().decode(decodedBuffer),
      );

      return {
        elements: data.elements || null,
        appState: data.appState || null,
      };
    } catch (error: any) {
      console.warn(
        "error when decoding shareLink data using the new format:",
        error,
      );
      return legacy_decodeFromBackend({ buffer, decryptionKey });
    }
  } catch (error: any) {
    window.alert(t("alerts.importBackendFailed"));
    console.error(error);
    return {};
  }
};

export type BackendDrawingListItem = {
  id: string;
  name: string | null;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  encryption_key?: string;
};

type ListDrawingsParams = {
  q?: string;
  ownerId?: string;
  projectId?: string;
  cursor?: string;
  page?: string;
  perPage?: number;
  includeEncryptionKey?: boolean;
};

type ListDrawingsResponse = {
  items: BackendDrawingListItem[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    has_more_pages: boolean;
    next_cursor: string | null;
  };
};

const listDrawingsPageFromBackend = async (
  params: ListDrawingsParams = {},
): Promise<ListDrawingsResponse> => {
  const endpoint = new URL(BACKEND_V2_GET, window.location.href);

  if (params.q) {
    endpoint.searchParams.set("q", params.q);
  }

  if (params.ownerId) {
    endpoint.searchParams.set("owner_id", params.ownerId);
  }

  if (params.projectId) {
    endpoint.searchParams.set("project_id", params.projectId);
  }

  if (params.cursor) {
    endpoint.searchParams.set("cursor", params.cursor);
  }

  if (params.page) {
    endpoint.searchParams.set("page", params.page);
  }

  if (typeof params.perPage === "number") {
    endpoint.searchParams.set("per_page", String(params.perPage));
  }

  if (params.includeEncryptionKey) {
    endpoint.searchParams.set("include_encryption_key", "true");
  }

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  const rawBody = await response.text();

  if (!response.ok) {
    const snippet = rawBody
      ? rawBody.slice(0, 180).replace(/\s+/g, " ").trim()
      : "";

    throw new Error(
      `${t("alerts.importBackendFailed")} (HTTP ${response.status}) - ${snippet}`,
    );
  }

  let body: unknown;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch (error) {
    const snippet = rawBody
      ? rawBody.slice(0, 180).replace(/\s+/g, " ").trim()
      : "";

    throw new Error(
      `${t("alerts.importBackendFailed")} (Invalid JSON response) - ${snippet}`,
    );
  }

  const parsedBody = body as Partial<ListDrawingsResponse> | null | undefined;

  if (!parsedBody?.items || !Array.isArray(parsedBody.items)) {
    return {
      items: [],
      meta: {
        page: 1,
        per_page: params.perPage || 0,
        total: 0,
        has_more_pages: false,
        next_cursor: null,
      },
    };
  }

  return parsedBody as ListDrawingsResponse;
};

export const listDrawingsFromBackend = async ({
  perPage = 100,
  ...params
}: ListDrawingsParams = {}): Promise<BackendDrawingListItem[]> => {
  const drawings: BackendDrawingListItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined = params.cursor;

  while (true) {
    const payload = await listDrawingsPageFromBackend({
      ...params,
      cursor,
      perPage,
    });

    drawings.push(...payload.items);

    if (!payload.meta?.has_more_pages || !payload.meta?.next_cursor) {
      break;
    }

    if (seenCursors.has(payload.meta.next_cursor)) {
      break;
    }
    seenCursors.add(payload.meta.next_cursor);
    cursor = payload.meta.next_cursor;
  }

  return drawings;
};

type ExportToBackendResult =
  | { url: null; errorMessage: string }
  | { url: string; errorMessage: null };

type SaveToBackendResult = {
  id: string | null;
  encryptionKey: string | null;
  errorMessage: string | null;
};

const persistDrawingToBackend = async ({
  payload,
  encryptionKey,
  drawingName,
  persistEncryptionKey,
}: {
  payload: Uint8Array;
  encryptionKey: string;
  drawingName?: string | null;
  persistEncryptionKey?: boolean;
}) => {
  const endpoint = new URL(BACKEND_V2_POST, window.location.href);

  const trimmedName = drawingName?.trim();
  if (trimmedName) {
    endpoint.searchParams.set("name", trimmedName);
  }

  const requestBody = new ArrayBuffer(payload.byteLength);
  new Uint8Array(requestBody).set(payload);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: persistEncryptionKey ? { "X-Drawing-Key": encryptionKey } : {},
    body: requestBody,
  });

  const rawBody = await response.text();
  let json: Record<string, unknown> = {};
  if (rawBody) {
    try {
      json = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (error) {
      json = {};
    }
  }

  const id = typeof json.id === "string" ? json.id : undefined;
  const errorClass =
    typeof json.error_class === "string" ? json.error_class : undefined;
  const message = typeof json.message === "string" ? json.message : undefined;

  return {
    ok: response.ok,
    status: response.status,
    id,
    errorClass,
    message,
  };
};

export const saveToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  opts?: {
    drawingName?: string | null;
    persistEncryptionKey?: boolean;
  },
): Promise<SaveToBackendResult> => {
  const encryptionKey = await resolveBackendEncryptionKey();

  const payload = await compressData(
    new TextEncoder().encode(
      serializeAsJSON(elements, appState, files, "database"),
    ),
    { encryptionKey },
  );

  try {
    /*
     * Temporarily disabled: uploading encrypted image binaries to Firebase.
     * Keep this block for quick re-enable once storage config is ready again.
     *
     * const filesMap = new Map<FileId, BinaryFileData>();
     * for (const element of elements) {
     *   if (isInitializedImageElement(element) && files[element.fileId]) {
     *     filesMap.set(element.fileId, files[element.fileId]);
     *   }
     * }
     *
     * const filesToUpload = await encodeFilesForUpload({
     *   files: filesMap,
     *   encryptionKey,
     *   maxBytes: FILE_UPLOAD_MAX_BYTES,
     * });
     */

    const { ok, status, id, errorClass, message } =
      await persistDrawingToBackend({
      payload,
      encryptionKey,
      drawingName: opts?.drawingName,
      persistEncryptionKey: opts?.persistEncryptionKey,
    });

    if (id) {
      /*
       * Temporarily disabled with file upload block above.
       * if (filesToUpload.length > 0) {
       *   await saveFilesToFirebase({
       *     prefix: `/files/shareLinks/${id}`,
       *     files: filesToUpload,
       *   });
       * }
       */

      return { id, encryptionKey, errorMessage: null };
    }

    if (errorClass === "RequestTooLargeError") {
      return {
        id: null,
        encryptionKey: null,
        errorMessage: t("alerts.couldNotCreateShareableLinkTooBig"),
      };
    }

    if (!ok) {
      return {
        id: null,
        encryptionKey: null,
        errorMessage: message ?? `${t("alerts.couldNotCreateShareableLink")} (HTTP ${status})`,
      };
    }

    return {
      id: null,
      encryptionKey: null,
      errorMessage: message ?? t("alerts.couldNotCreateShareableLink"),
    };
  } catch (error: any) {
    console.error(error);

    return {
      id: null,
      encryptionKey: null,
      errorMessage: t("alerts.couldNotCreateShareableLink"),
    };
  }
};

export const exportToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<ExportToBackendResult> => {
  const { id, encryptionKey, errorMessage } = await saveToBackend(
    elements,
    appState,
    files,
    { persistEncryptionKey: false },
  );

  if (errorMessage) {
    return { url: null, errorMessage };
  }

  if (!id || !encryptionKey) {
    return { url: null, errorMessage: t("alerts.couldNotCreateShareableLink") };
  }

  const url = new URL(window.location.href);
  // We need to store the key (and less importantly the id) as hash instead
  // of queryParam in order to never send it to the server
  url.hash = `json=${id},${encryptionKey}`;

  return { url: url.toString(), errorMessage: null };
};
