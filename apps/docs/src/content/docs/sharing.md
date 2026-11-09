---
title: Sharing
description: Send files and folders with private links or public CDN links, and take them back.
---

Select a file or folder and choose **Share**. There are two kinds of link.

|                | Private link                       | Public CDN link                       |
| -------------- | ---------------------------------- | ------------------------------------- |
| Best for       | Sending files to particular people | Embedding a file on a website         |
| Works on       | Files and folders                  | Files                                 |
| Password       | Optional                           | No                                    |
| Expiry         | Optional                           | No                                    |
| Download count | Yes                                | No                                    |
| Taking it back | New visits stop at once            | Stops when the CDN's cache expires    |
| Needs          | Nothing extra                      | [Public access](#set-up-public-links) |

Use a private link unless you need a permanent, cacheable URL. [How it works](/how-it-works/#sharing) explains why they're built differently.

## Private links

1. In the **Share** dialog, choose when the link **Expires**: **Never**, or in 1 hour, 1 day, 7 days or 30 days.
2. Optionally set a **Password** of at least 8 characters.
3. Choose **Create link**, then copy the address. It looks like `APP_URL/share/<token>`.

Anyone with a link to a file can download it. Anyone with a link to a folder can browse and download everything in it, including its subfolders and anything added later.

An item can have several links, for example one for each person. The dialog lists them all with their download counts. **Show** brings a link's address back so you can copy it again. A link marked **too old to show again** still works, but its address can't be displayed, so create a new one if you've lost it.

After 10 wrong password attempts, a link is locked for 15 minutes.

### End a private link

Choose **Revoke** beside the link. New visits stop right away, but a download already started can continue, because a download URL that was already issued keeps working for up to 15 minutes.

A link stops working in any of these cases:

- It's revoked or expires.
- The file or folder is moved to trash. Restoring it doesn't bring the link back.
- The file goes missing from the bucket.
- The owner's account is disabled. The link works again if the account is enabled.

A visitor sees the same "not available" message in each case, so a link never reveals why it stopped.

## Public CDN links

A public link serves a copy of the file from your CDN's domain. The **Public CDN link** tab appears in the **Share** dialog for files on a storage with public access set up.

:::caution
Anyone with a public link can download the file. It has no password, expiry or download count.
:::

Choose **Publish** to create the copy and get its address.

- The copy is stored separately, and your provider bills for it.
- The copy doesn't follow changes to the original. If the file changes or goes missing, the dialog says the copy is out of date. **Republish** replaces it and creates a new link.
- Publishing again always creates a new link, so an old address never comes back to life.

### End a public link

Choose **Unpublish**. Moving the file to trash does the same, and restoring it doesn't publish it again.

The copy is deleted from the bucket, but the CDN can keep serving its cached version until the cache expires. Public copies are sent with a one-hour cache lifetime unless your CDN overrides it.

## Set up public links

Each storage needs a CDN pointed at a separate public location. In **Settings > Storages**, open the storage's menu and choose **Public access**. [Public CDN links](/deploying/#public-cdn-links) covers the setup.

Before a storage can publish, Fileee checks that private files can't be reached through the CDN. The check repeats with each sync. If it fails, the storage shows **CDN check failing** and new publishing is blocked, but copies already published stay up. [Troubleshooting](/troubleshooting/#sharing) lists the usual causes.
