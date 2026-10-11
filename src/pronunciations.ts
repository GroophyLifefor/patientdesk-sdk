import type { HttpCore } from "./client.js";
import type {
  DeletePronunciationResponse,
  PronunciationsListResponse,
  Pronunciation,
  SavePronunciationParams,
} from "./types.js";

/**
 * Saved pronunciation dictionary (`/v1/pronunciations`): applied to every
 * speech request on the account. A per-request `pronunciations` field beats it.
 *
 * ```ts
 * await pd.pronunciations.add({ term: "PatientDesk", say_as: "Peyşınt Desk" });
 * ```
 */
export class PronunciationsApi {
  constructor(private readonly core: HttpCore) {}

  /** `GET /v1/pronunciations` — the account's saved entries. */
  async list(): Promise<PronunciationsListResponse> {
    const response = await this.core.request("/pronunciations", { method: "GET", headers: this.core.headers() });
    return (await response.json()) as PronunciationsListResponse;
  }

  /** `POST /v1/pronunciations` — add a term or update an existing one. */
  async add(params: SavePronunciationParams): Promise<Pronunciation> {
    const response = await this.core.request("/pronunciations", {
      method: "POST",
      headers: this.core.headers(),
      body: JSON.stringify({ term: params.term, say_as: params.say_as }),
    });
    return (await response.json()) as Pronunciation;
  }

  /** `DELETE /v1/pronunciations/{id}` — delete an entry by id. */
  async delete(id: string): Promise<DeletePronunciationResponse> {
    const response = await this.core.request(`/pronunciations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.core.headers(),
    });
    return (await response.json()) as DeletePronunciationResponse;
  }
}
