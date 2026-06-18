# Releasing ShotBank

This guide is for the maintainer. It explains how to publish a release and how
to get **free code signing** so users stop seeing the Windows SmartScreen
warning.

## Why signing matters

ShotBank's installer is unsigned by default. The first time someone runs an
unsigned `.exe`, Windows shows:

> **Windows protected your PC** -- Microsoft Defender SmartScreen prevented an
> unrecognized app from starting.

Technical users click **More info -> Run anyway**. Non-technical users often give
up. Code signing with a certificate from a trusted authority removes this
warning. We use **SignPath Foundation**, which signs open-source projects for
free.

## One-time: set up free signing with SignPath Foundation

1. Go to <https://signpath.org/> and apply to the **Foundation (open source)**
   program with this GitHub repository. Approval is manual and free.
2. Once approved, open your SignPath dashboard and note:
   - **Organization ID** (a GUID)
   - **Project slug** -- create a project for ShotBank (use `shotbank`)
   - **Signing policy slug** -- e.g. `release-signing`
3. Create an **API token** in SignPath (User settings -> API tokens).
4. In GitHub: **Settings -> Secrets and variables -> Actions -> New secret**
   - Name: `SIGNPATH_API_TOKEN`
   - Value: the token from step 3
5. Edit [`.github/workflows/release.yml`](.github/workflows/release.yml) and fill
   in the `env:` block:
   ```yaml
   SIGNPATH_ORGANIZATION_ID: "<your-org-guid>"
   SIGNPATH_PROJECT_SLUG: "shotbank"
   SIGNPATH_SIGNING_POLICY_SLUG: "release-signing"
   ```

That's it. From then on, every release is signed automatically.

> Until SignPath is configured, the release workflow still runs and publishes an
> **unsigned** installer -- it just skips the signing step, so releases never
> break while approval is pending.

## Publishing a release

1. Bump the version in `package.json`.
2. Commit and tag:
   ```bash
   git commit -am "release: v0.1.1"
   git tag v0.1.1
   git push origin main --tags
   ```
3. Create a GitHub Release for the tag (or the tag push alone will trigger the
   build). The workflow builds `ShotBank Setup <version>.exe`, signs it (if
   configured), and attaches it to the Release.

## Building locally (for testing)

```bash
npm run electron:dist
```

The installer is written to `dist/ShotBank Setup <version>.exe`.
Local builds are **not** signed -- use the GitHub release flow for signed builds.

## Other free options (alternatives to SignPath)

- **Build SmartScreen reputation over time** -- as more people download a given
  signed `.exe`, SmartScreen learns to trust it. Free but gradual, and resets
  when the file changes.
- **Ship unsigned + document the click-through** -- the README tells users how to
  get past SmartScreen. Free and immediate; the warning still appears.

A self-signed certificate is **not** a solution: it does not satisfy SmartScreen
and can make the download look more suspicious, not less.
