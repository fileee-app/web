---
title: Using Fileee
description: Upload, organize, preview, find and delete files.
---

This page is for anyone with a Fileee account. If you don't have a storage yet, see [Storage providers](/providers/), or add one from **Connect storage** in the sidebar.

## Find your way around

**Home** shows your storages, your starred files and your recent files. Each storage has its own entry in the sidebar, and opening one shows its folders and files. **Trash** and **Settings** are at the bottom of the sidebar, and your account menu below them has **Sign out**.

In a folder, switch between list and grid view with the buttons in the toolbar.

## Upload files

Drop files or folders anywhere on a folder's page, or use **Upload > Files** or **Upload > Folder**. The upload tray shows progress.

Files go straight from your browser to the bucket, so keep the tab open until they finish. If an upload is cut off, for example by closing the tab, the tray lists it as **Interrupted**. A file of 16 MiB or more can continue from where it stopped if you pick the same file again within 7 days. Use **Discard** if you no longer want it.

The largest file you can upload is 5 TiB.

## Work with files and folders

Click an item to select it, or use its checkbox to select several. Shift-click selects a range. Double-click opens a folder or previews a file.

Selected items get a toolbar with their actions. Every item also has a menu, through its **...** button or a right-click:

| Action            | What it does                                                  |
| ----------------- | ------------------------------------------------------------- |
| **Open, Preview** | Opens a folder or previews a file                             |
| **Details**       | Shows a file's size, dates and metadata                       |
| **Download**      | Downloads the file                                            |
| **Share**         | Creates a link. See [Sharing](/sharing/)                      |
| **Rename**        | Changes the name in Fileee. The bucket's object keeps its key |
| **Move**          | Moves items to another folder                                 |
| **Star**          | Adds files to **Starred** on the Home page                    |
| **Move to trash** | Moves items to trash and ends their share links               |

**New folder** in the toolbar creates a folder. You can also drag items onto a folder to move them. Folders can't be starred.

Names are unique within a folder. If a name is already taken when you upload, rename or move something, Fileee adds a number, as in `photo (1).jpg`.

## Preview files

| Type            | Preview                         |
| --------------- | ------------------------------- |
| Images          | Shown in the browser            |
| Video and audio | Played in the browser           |
| PDF             | Shown page by page              |
| Text and code   | Shown as text, first 1 MiB only |
| Anything else   | Download it instead             |

**Details** also shows what Fileee could read from the file, such as an image's dimensions and camera, a PDF's page count and author, or a video's duration.

Files that were already in the bucket have no thumbnail at first. To create them, see [Backfill thumbnails](/administering/#manage-your-storages).

## Search

Use the search box in the sidebar. Search looks at file names, plus the title, author and camera from a file's metadata. It matches the start of words, and every word you type has to match.

The results page can narrow things down by **Type**, **Size**, **Storage**, and **Modified from** or **Modified to**.

## Jump anywhere with the command palette

Press <kbd>⌘</kbd> <kbd>K</kbd> on a Mac, or <kbd>Ctrl</kbd> <kbd>K</kbd> elsewhere, from any page. Type to go to a page or storage, connect a storage, switch theme, or find a file.

## Keyboard shortcuts

These work in a folder when you aren't typing in a field. The keyboard button in the toolbar lists them too.

| Keys                                           | Action          |
| ---------------------------------------------- | --------------- |
| <kbd>↑</kbd> <kbd>↓</kbd>                      | Move selection  |
| <kbd>Shift</kbd> + click                       | Select a range  |
| <kbd>⌘</kbd> or <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select all      |
| <kbd>Enter</kbd>                               | Open            |
| <kbd>F2</kbd>                                  | Rename          |
| <kbd>M</kbd>                                   | Move            |
| <kbd>S</kbd>                                   | Star or unstar  |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd>      | Move to trash   |
| <kbd>Esc</kbd>                                 | Clear selection |

## Trash

Moving something to trash keeps it in your bucket until you say otherwise. Nothing expires by itself.

On the **Trash** page, each item's menu has **Restore** and **Delete forever**. **Empty trash** deletes everything in trash across all your storages.

:::caution
**Delete forever** and **Empty trash** remove files from your bucket, and Fileee can't undo that.
:::

Restoring an item doesn't bring back its share links or public copy, so you'd need to create those again.

## Missing files

If a folder shows a **missing** badge, the bucket no longer has some files at the keys Fileee knows. They were probably moved, renamed or deleted outside Fileee.

Open the badge to see the list. Their names, stars and folders are kept, and a file that comes back at the same key is restored by the next sync.

## Your account

In **Settings > Account** you can change your name and password. Changing your password signs out your other devices.

**Appearance** sets the theme and accent colour. These are saved in the browser you're using, so another device keeps its own.

If you forget your password, ask your admin to reset it.
