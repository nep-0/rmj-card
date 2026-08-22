# RMJ Card Server

Node.js service that fetches RMJ Formula statistics and returns downloadable player-card images.

## Endpoints

- `GET /health` — returns `{"status":"ok"}`.
- `GET /api/player-cards/:name.png` — returns a PNG player card. `style` defaults to `modern`; pass `?style=QH` for the QH style.
- `GET /api/player-cards/:name.svg` — returns the rendered SVG player card when `DISABLE_SVG` is not enabled. It accepts the same `style` parameter.
- `GET /api/player-stats/:name.txt` — returns aggregate player statistics as UTF-8 plain text.
- `GET /api/player-opponents/good/:name.txt` — returns the first 10 opponents as `好人榜`.
- `GET /api/player-opponents/bad/:name.txt` — returns the last 10 opponents as `仇人榜`; the service fetches the final two upstream pages when available.

Supported styles are `modern` and `QH`. `QH` is presently a separate copy of the modern composition, ready for independent styling; it does not change the default card.
The Formula crypto session is maintained in memory by one `FormulaClient` instance and reused across requests. It is recreated when it expires. The session is process-local; running multiple replicas creates one upstream session per replica.

## Run locally

Requirements: Node.js 24 or newer.

```sh
npm ci
npm start
```

The service listens on `http://localhost:${PORT}`. Example:

```sh
curl -f http://localhost:3000/health
curl -f -o player-card.png 'http://localhost:3000/api/player-cards/NeP.png'
curl -f -o player-card-qh.png 'http://localhost:3000/api/player-cards/NeP.png?style=QH'
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `DISABLE_SVG` | unset / disabled | When set to `1`, `true`, or `yes` (case-insensitive), SVG requests return HTTP `404`; PNG access is unchanged. |

There are currently no Formula API URL, credential, or crypto-session environment variables. Formula access uses the public upstream API and the client generates and refreshes its own in-memory cryptographic session.

## OCI image

The GitHub Actions workflow at `.github/workflows/container-image.yml` builds the image on pull requests and pushes it to GitHub Container Registry on `main` and version tags. Published images use:

```text
ghcr.io/<owner>/<repository>:latest
ghcr.io/<owner>/<repository>:sha-<commit>
```

Build and run locally:

```sh
docker build -t rmj-card .
docker run --rm -p 3000:3000 -e PORT=3000 rmj-card
```

The image includes the embedded `NotoSansSC-Regular.otf` font required for Chinese text in SVG and PNG output. It runs as the unprivileged `node` user.

## Development checks

```sh
npm run build
npm test
```
