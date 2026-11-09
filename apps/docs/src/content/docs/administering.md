---
title: Administering
description: Manage user accounts, the instance name and connected storages.
---

The first account, created during [first-run setup](/installing/#first-run-setup), is an admin. Admins manage accounts and instance settings. They can't open another user's files or storages.

## Manage users

Go to **Settings > Users**.

### Add a user

Choose **Add user** and enter their name, email, a password of at least 12 characters, and a role.

Fileee doesn't send email, so give them the password yourself. They can change it in **Settings > Account**.

| Role      | Can do                                                    |
| --------- | --------------------------------------------------------- |
| **User**  | Connect their own storages, and use and share their files |
| **Admin** | All of that, and manage users and instance settings       |

Each user connects their own storages and sees only those. To give several people the same bucket, each of them needs their own storage for it, and they won't see each other's folders, stars or trash.

### Change an account

Each user's **...** menu has these actions:

| Action             | Effect                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Reset password** | Sets a new password and signs them out everywhere                                                                      |
| **Disable**        | Signs them out and blocks sign-in. Their share links stop, and their public copies are removed                         |
| **Enable**         | Lets them sign in again. Their share links work again, but they have to publish public copies again                    |
| **Delete**         | Removes the account and its connected storages from Fileee. Files in their buckets stay, but public copies are removed |

You can't disable or delete your own account, and the last active admin can't be disabled or deleted.

To reset an admin password when nobody can sign in, see [Recover access](/deploying/#recover-access).

## Name the instance

In **Settings > General**, **App name** changes the name in the sidebar, page titles and on the sign-in page. It can be up to 50 characters and is visible to anyone who opens the sign-in page. Leave it empty to use Fileee.

## Manage your storages

Any user can do this for their own storages, in **Settings > Storages**. [Connect a bucket](/installing/#connect-a-bucket) covers adding one, and [Storage providers](/providers/) has steps for each provider.

A storage's badges tell you its state:

| Badge                    | Meaning                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Connected**            | The last connection check passed                                                                           |
| **Not tested**           | No check has run yet                                                                                       |
| **Check failed**         | The last check failed. Run **Check connection** to see why                                                 |
| **Re-enter credentials** | The stored key can't be read. See [Troubleshooting](/troubleshooting/#a-storage-says-re-enter-credentials) |
| **Public links on**      | The storage can publish [public CDN links](/sharing/#public-cdn-links)                                     |
| **CDN check failing**    | The safety check failed, so new publishing is blocked                                                      |

**Sync now** makes the index match the bucket straight away. It also runs when a storage is connected and once a day. See [Sync](/how-it-works/#sync) for what it does.

The storage's **...** menu has the rest:

| Action                  | Use it to                                                                        |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Check connection**    | Test reading and writing, and browser access. Set up or test the CORS rule       |
| **Edit**                | Change settings or rotate the key. Blank credential fields keep the current ones |
| **Public access**       | Set up the CDN URL and public location                                           |
| **Backfill thumbnails** | Make thumbnails and read metadata for imported files                             |
| **Remove**              | Disconnect the storage                                                           |

**Backfill thumbnails** runs in your browser. It downloads each file that needs it, so your provider may charge for the transfer, and you need to keep the window open until it finishes.

### Remove a storage

Removing a storage makes Fileee forget the connection and its index. Files in the bucket aren't deleted, but folder names you set in Fileee are lost. Public copies are deleted, and their links stop working.

If you connect the same bucket again, sync finds the files again. Files that Fileee uploaded come back in a **Recovered** folder.

If Fileee can't delete a public copy, for example because the key was revoked, **Settings > Storages** shows a warning with its address. Fileee keeps retrying, or you can delete the object from the bucket yourself.
