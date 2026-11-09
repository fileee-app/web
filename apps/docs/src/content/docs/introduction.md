---
title: Introduction
description: What Fileee is, what it deliberately leaves out, and who it suits.
---

Fileee is a self-hosted, Google Drive-style file manager for S3-compatible storage. Connect buckets you already own and get folders, previews, search, trash and share links in the browser.

Your files stay in your bucket. Fileee keeps only metadata and encrypted credentials, and browsers upload and download directly from the bucket. [How it works](/how-it-works/) explains the details.

## What you get

- **Your own storage:** AWS S3, Cloudflare R2, Backblaze B2, MinIO and [other S3-compatible providers](/providers/).
- **A familiar file browser:** folders, list and grid views, drag and drop, stars and keyboard shortcuts. See [Using Fileee](/using/).
- **Previews:** images, video, audio, PDFs, text and code.
- **Search:** across file names and metadata such as title, author and camera.
- **Files added elsewhere:** sync finds objects that were already in the bucket, so you can start with an existing one.
- **Sharing:** private links with an optional password and expiry, and optional public links through your CDN. See [Sharing](/sharing/).
- **Several users:** an admin creates accounts, and each user sees only the storages they connected. See [Administering](/administering/).

## What it doesn't do

- **No shared team spaces.** Each user connects their own storages, and accounts can't see each other's files. Share links are the way to pass files between people.
- **No desktop or mobile sync app.** Fileee runs in the browser.
- **No document editing.** Files can be previewed and downloaded, but not changed in place.
- **No encryption of file contents, two-factor login, SSO, email, audit log or malware scanning.** [Security](/security/#what-fileee-doesnt-do) covers what that means for you.
- **No replicas.** Background jobs run inside the server process, so you run exactly one instance.

## Who it suits

Fileee is a good fit if you want a simple interface over storage you control, for yourself or a small group, and you're comfortable running a Docker container.

Look elsewhere if you need one drive shared by a whole team, compliance features such as an audit log, or an app that keeps a folder on your computer in sync.

## What you need

- A server that can run Docker with Compose, or Node 24 and Postgres 13 or newer.
- A bucket at an S3-compatible provider, and a credential for it.
- HTTPS and a domain, if the instance will be on a public address.

## Next steps

1. [Install Fileee](/installing/).
2. [Set up your storage provider](/providers/).
3. [Deploy it](/deploying/), if other people will reach it over the internet.
