import type { HttpCore } from "./client.js";
import type { ModelsListResponse, StylesListResponse } from "./types.js";

/** Ready-made conversation styles (`GET /v1/styles`). */
export class StylesApi {
  constructor(private readonly core: HttpCore) {}

  /** `GET /v1/styles` — the ready-made style ids usable in `style`. */
  async list(): Promise<StylesListResponse> {
    const response = await this.core.request("/styles", { method: "GET", headers: this.core.headers() });
    return (await response.json()) as StylesListResponse;
  }
}

/** The Alania model catalog (`GET /v1/alania/models`). */
export class ModelsApi {
  constructor(private readonly core: HttpCore) {}

  /** `GET /v1/alania/models` — models with their default/legacy/free flags. */
  async list(): Promise<ModelsListResponse> {
    const response = await this.core.request("/alania/models", { method: "GET", headers: this.core.headers() });
    return (await response.json()) as ModelsListResponse;
  }
}
