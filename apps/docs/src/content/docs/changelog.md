---
title: Changelog
description: Notable changes to Fileee, newest first.
---

Fileee doesn't publish numbered releases yet. You install it from source, so this page lists notable changes by date. To apply them, follow [Upgrade](/deploying/#upgrade), and back up first.

## Unreleased

- Reopen existing share links: **Show** in the **Share** dialog brings back the address of a link you've already created.
- This documentation site, with new guides for [using Fileee](/using/), [sharing](/sharing/), [administering](/administering/) and [storage providers](/providers/).

## 2026-11-08

### Added

- First version of Fileee, under the MIT license.
- Presets for popular S3-compatible providers when connecting a storage.
- **How to set up** on the storage check, which replaces **Show rule**. It gives the CORS rule and an IAM policy for your bucket.

### Fixed

- The browser CORS test no longer requires a readable ETag, so it stops failing on rules that don't expose one.
