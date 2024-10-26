import { Permission, Role } from "appwrite";

export const userAccess = (accountId: string) => [
  Permission.update(Role.user(accountId)),
  Permission.delete(Role.user(accountId)),
  Permission.read(Role.user(accountId)),
  Permission.write(Role.user(accountId)),
];
