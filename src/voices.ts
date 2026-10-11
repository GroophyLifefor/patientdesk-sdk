import type { HttpCore } from "./client.js";
import { bytesToBlob, toUint8Array } from "./bytes.js";
import type {
  DeleteVoiceResponse,
  SaveVoiceParams,
  SaveVoiceResponse,
  VoicesListResponse,
} from "./types.js";

/**
 * Saved voices (`/v1/voices`): built-ins plus the account's clones and designs.
 *
 * ```ts
 * const { data } = await pd.voices.list();
 * await pd.voices.delete(id);
 * ```
 */
export class VoicesApi {
  constructor(private readonly core: HttpCore) {}

  /** `GET /v1/voices` — built-in voices and the account's saved ones. */
  async list(): Promise<VoicesListResponse> {
    const response = await this.core.request("/voices", { method: "GET", headers: this.core.headers() });
    return (await response.json()) as VoicesListResponse;
  }

  /**
   * `POST /v1/voices` — save a clone (`file` + `consent`) or a design
   * (`voice_description` + `seed` + `input`).
   */
  async save(params: SaveVoiceParams): Promise<SaveVoiceResponse> {
    const response = params.file
      ? await this.core.request("/voices", {
          method: "POST",
          headers: this.core.authHeaders(),
          body: await cloningForm(params),
        })
      : await this.core.request("/voices", {
          method: "POST",
          headers: this.core.headers(),
          body: JSON.stringify({
            name: params.name,
            ...(params.voice_description !== undefined ? { voice_description: params.voice_description } : {}),
            ...(params.seed !== undefined ? { seed: params.seed } : {}),
            ...(params.input !== undefined ? { input: params.input } : {}),
            ...(params.cfg !== undefined ? { cfg: params.cfg } : {}),
            ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
            ...(params.pronunciations !== undefined ? { pronunciations: params.pronunciations } : {}),
          }),
        });
    return (await response.json()) as SaveVoiceResponse;
  }

  /** `DELETE /v1/voices/{id}` — delete a saved voice by id. */
  async delete(id: string): Promise<DeleteVoiceResponse> {
    const response = await this.core.request(`/voices/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.core.headers(),
    });
    return (await response.json()) as DeleteVoiceResponse;
  }
}

async function cloningForm(params: SaveVoiceParams): Promise<FormData> {
  const form = new FormData();
  form.append("name", params.name);
  const bytes = await toUint8Array(params.file!);
  form.append("file", bytesToBlob(bytes, "application/octet-stream"), "voice-sample");
  if (params.transcript !== undefined) form.append("transcript", params.transcript);
  if (params.consent !== undefined) form.append("consent", String(params.consent));
  return form;
}
