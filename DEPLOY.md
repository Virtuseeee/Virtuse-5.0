# Deploying virtuse.com

Four targets. Two commands cover all of them; each ends with a single
**OK** line, or with **NOT COMPLETE** and the reason. Anything else means it
did not finish.

| Target | What | How it gets there | Checked by |
|---|---|---|---|
| `main` | source of truth | `deploy_site.sh` pushes it | git |
| staging.virtuse.com | `gh-pages` branch, GitHub Pages | `deploy_site.sh` copies the changed files | md5 of every file (waits up to 8 min for Pages) |
| virtuse.com | Webglobe, SFTP `ftp.virtuse.com:222`, `public_html/` | `deploy_site.sh` uploads | md5 of every file, one automatic re-upload of mismatches |
| Worker `virtuse-newsletter` | `/subscribe`, `/send`, `/unsubscribe`, `/pulse.json`, `/wp/*` | `deploy_worker.sh`, always from `origin/main` | `GET /version` = deployed commit + 5 route checks |

## Site: `deploy_site.sh`

```bash
bash deploy_site.sh <from-commit> [to-commit]
```

Run from the repo root on a Mac with an SFTP login. Order:

1. Stops if `origin/main` has commits this checkout lacks.
2. **SFTP login first**: asks for the username and the password once. A
   wrong login stops here, before anything is pushed.
3. Push `main`, sync `gh-pages`.
4. Upload in sftp batch mode: any failed `put` aborts with an error instead of
   being skipped. Files deleted in the range (old `concierge-assets/` hashes)
   are removed on staging and production too.
5. md5 of every uploaded file on production. Mismatches are uploaded once
   more and re-checked. Deleted files must no longer return 200.
6. md5 on staging.
7. After `DEPLOY OK`: IndexNow ping with the range's indexable pages
   (`seo-ops/indexnow.py --range`, see `seo-ops/README.md`). A failed ping is
   printed but never changes the deploy result.

Useful variants: `DRY_RUN=1` (show the file list and the sftp batch, change
nothing), `LOGIN_ONLY=1` (only test the SFTP login).

Login: the username default comes from `~/.ssh/config` (`Host ftp.virtuse.com`,
`User …`, `Port 222`). The account and password are in Webglobe WebAdmin →
virtuse.com → Hosting → FTP a súbory → FTP účty. Type the password into your
own terminal; never paste it into a chat.

Not covered by the script, still by hand: the server's `public_html/.htaccess`
(see `seo-ops/README.md`), story pages (`stories-build/upload.sftp`), and the
WordPress must-use plugins on blog.virtuse.com.

## Worker: `deploy_worker.sh`

```bash
bash deploy_worker.sh            # push your Worker change to main first
DRY_RUN=1 bash deploy_worker.sh  # build + tests + wrangler --dry-run
```

Deploys `origin/main`, never the local folder (the OneDrive checkout has
lagged behind origin before, which would roll routes back). Needs
`npx wrangler login` once. Check what is live any time:
`curl https://virtuse-newsletter.virtuse-ai.workers.dev/version`.

Order when both change (e.g. a new form field): Worker first, then site.

## Layer 2 modules (Partner Finder, Stacking, Loan, Tax Agent)

Source is in git at `layer2-src/` (see its README). Build there, copy with
`i18n-tools/layer2/deploy.py`, commit source and `concierge-assets/` together,
then `deploy_site.sh`. CI (`layer2-verify.yml`) rebuilds from source and fails
if the committed bundle differs, and the build fails if the Stacking fee table
differs from `seo-build/data/fee-schedule-live.json`. Never patch the built
bundle by hand.
