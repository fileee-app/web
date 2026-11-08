import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@fileee/ui/components/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@fileee/ui/components/table";
import {
  MoreHorizontalIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  Trash2Icon,
} from "lucide-react";
import { DateText } from "../../../components/date-text.tsx";
import { client } from "../../../lib/orpc.ts";

export type UserRow = Awaited<ReturnType<typeof client.user.list>>[number];

export function UsersTable({
  users,
  meId,
  onReset,
  onDelete,
  onSetDisabled,
}: {
  users: UserRow[];
  meId: string;
  onReset: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onSetDisabled: (change: { userId: string; disabled: boolean }) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="max-sm:hidden">Created</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground">{user.email}</div>
            </TableCell>

            <TableCell>
              <div className="flex gap-1">
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role === "admin" ? "Admin" : "User"}
                </Badge>

                {user.disabledAt && <Badge variant="destructive">Disabled</Badge>}
              </div>
            </TableCell>

            <TableCell className="text-muted-foreground max-sm:hidden">
              <DateText date={user.createdAt} />
            </TableCell>

            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Actions for ${user.name}`}
                    />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => onReset(user)}>
                    <KeyRoundIcon />
                    Reset password
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    disabled={user.id === meId}
                    onClick={() => onSetDisabled({ userId: user.id, disabled: !user.disabledAt })}
                  >
                    {user.disabledAt ? <ShieldCheckIcon /> : <ShieldOffIcon />}
                    {user.disabledAt ? "Enable" : "Disable"}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    variant="destructive"
                    disabled={user.id === meId}
                    onClick={() => onDelete(user)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
