# Releasing patientdesk-sdk

A release goes from a `docs-drift` issue to a merged PR, then to a tag. Pushing
the tag publishes to npm and creates the GitHub Release.

## 1. The trigger: a docs-drift issue

`.github/workflows/docwatch.yml` runs every day at 09:17 Istanbul time. It
compares PatientDesk's public docs (TR and EN) with the snapshots on the
`upstream-docs` branch. When a page changed, it opens an issue labelled
`docs-drift` titled `Dokümanlar değişti: N sayfa (YYYY-MM-DD)`, with a diff per
page. While that issue is open, later drift is added to it as a comment. It never
touches `main`.

Read the whole issue, comments included, and decide what the SDK has to change.
Some drift is prose only and needs no release.

## 2. Pick the version

Follow semver on the `0.x` line:

- **Patch** (`0.2.2` to `0.2.3`): additive changes that track PatientDesk, such
  as a new option, a new event field, or a new error that is not retried. Nothing
  existing breaks.
- **Minor** (`0.1.0` to `0.2.0`): a breaking change, a new model generation, or a
  new group of endpoints.

## 3. Branch and change

```sh
git switch main && git pull
git switch -c release/X.Y.Z
```

One release branch holds everything for the release:

- **Code** in `src/`, with unit tests in `test/unit/`. Unit tests use no key
  and no network.
- **Docs** in `docs/md/`: update the guides the change touches, and the README
  when its examples change.
- **Migration guide** `docs/md/X.Y.Z.md` ("Upgrading to X.Y.Z"): at a glance,
  the details with an example, backward compatibility, how to verify. Copy the
  shape of the previous one.
- **Docs nav**: add `{ slug: "X.Y.Z", label: "A.B.C to X.Y.Z" }` to the
  upgrading section of `NAV` in `scripts/build-docs.mjs`.
- **Version**: `npm version X.Y.Z --no-git-tag-version` updates both
  `package.json` and `package-lock.json`.
- **Generated docs**: `npm run docs:build` writes `docs/docs/*.html`,
  `docs/index.html`, `docs/llms*.txt`, `docs/sitemap.xml` and the search index.
  Commit them with the sources.

## 4. Verify locally

```sh
npm run typecheck
npm test
npm run docs:build
node scripts/check-docs-prose.mjs
node scripts/check-docs-links.mjs
npm pack --dry-run
```

The prose check reports style issues, such as semicolons, but exits 0. Fix
what it reports anyway. `npm run full-test` also runs the live tests and needs an
API key.

## 5. Commit, PR, merge

One commit per release is the convention:

```sh
git commit -am "Release X.Y.Z: <what changed>"
git push -u origin release/X.Y.Z
gh pr create --title "Release X.Y.Z: <what changed>" --body "..."
```

The PR body says which issue it tracks (`Closes #N`), lists the changes, says
whether anything breaks, and lists the checks that ran. CI
(`.github/workflows/ci.yml`) runs typecheck, build, unit tests and
`npm pack --dry-run` on Node 20, 22 and 24. Merge when it is green. Merging
closes the docs-drift issue. The push to `main` also redeploys the docs site
(`.github/workflows/docs.yml`).

## 6. Tag and publish

Tag the merge commit on `main`:

```sh
git switch main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

`.github/workflows/release.yml` runs on any `v*` tag. It:

1. fails when the tag does not match `package.json` (`v0.2.3` needs
   `"version": "0.2.3"`),
2. runs `npm publish --provenance --access public` with the `NPM_TOKEN` secret,
3. creates the GitHub Release with generated notes, which list the merged PRs.

## 7. Check the release

```sh
gh run list --workflow release.yml -L 1
npm view patientdesk-sdk version
gh release view vX.Y.Z
```

A version published to npm cannot be published again. If something is wrong
after publishing, fix it and release the next patch.
