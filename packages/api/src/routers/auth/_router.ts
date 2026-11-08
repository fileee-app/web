import { changePassword } from "./change-password.ts";
import { login } from "./login.ts";
import { logout } from "./logout.ts";
import { me } from "./me.ts";
import { updateProfile } from "./update-profile.ts";

export const authRouter = { login, logout, me, updateProfile, changePassword };
