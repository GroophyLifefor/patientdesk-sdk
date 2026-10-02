# patientdesk-sdk

**Unofficial** SDK for [PatientDesk](https://speech.patientdesk.ai) Turkish voice models:

- **Alania** — text-to-speech (`POST /v1/audio/speech`)
- **Duyu** — speech-to-text (`POST /v1/audio/transcriptions`, plus experimental streaming)

> Not affiliated with or endorsed by PatientDesk.

> **Status: `0.0.1` is an intentionally empty placeholder.** It exists only to
> exercise the release pipeline (tag → GitHub Release → npm publish). The
> working API ships in `0.1.0`.

## Install

```sh
npm install patientdesk-sdk
```

## Release flow

Releases are automated from tags:

1. Bump `version` in `package.json` and push to `main`.
2. Push a matching tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. The `release` workflow verifies the tag matches `package.json`, publishes to
   npm with provenance, and creates a GitHub Release.

A required repository secret `NPM_TOKEN` (an npm automation token with publish
rights for `patientdesk-sdk`) must be set under **Settings → Secrets and
variables → Actions**.

## License

[MIT](./LICENSE)
