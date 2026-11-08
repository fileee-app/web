import { create } from "./create.ts";
import { list } from "./list.ts";
import { remove } from "./remove.ts";
import { resetPassword } from "./reset-password.ts";
import { setDisabled } from "./set-disabled.ts";

export const userRouter = { list, create, resetPassword, setDisabled, remove };
