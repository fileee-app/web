import { authRouter } from "./auth/_router.ts";
import { fileRouter } from "./file/_router.ts";
import { folderRouter } from "./folder/_router.ts";
import { searchRouter } from "./search/_router.ts";
import { settingsRouter } from "./settings/_router.ts";
import { shareRouter } from "./share/_router.ts";
import { setupRouter } from "./setup/_router.ts";
import { storageRouter } from "./storage/_router.ts";
import { trashRouter } from "./trash/_router.ts";
import { uploadRouter } from "./upload/_router.ts";
import { userRouter } from "./user/_router.ts";

export const router = {
  auth: authRouter,
  setup: setupRouter,
  settings: settingsRouter,
  user: userRouter,
  storage: storageRouter,
  folder: folderRouter,
  file: fileRouter,
  upload: uploadRouter,
  trash: trashRouter,
  search: searchRouter,
  share: shareRouter,
};

export type Router = typeof router;

export type { Context } from "../lib/orpc.ts";
