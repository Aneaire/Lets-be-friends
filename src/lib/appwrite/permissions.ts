import { Permission, Role } from "appwrite";

export const userAccess = (accountId: string) => [
  Permission.update(Role.user(accountId)),
  Permission.delete(Role.user(accountId)),
  Permission.read(Role.user(accountId)),
  Permission.write(Role.user(accountId)),
];

export const userToAny = (accountId: string) => [
  Permission.read(Role.any()),
  Permission.update(Role.user(accountId)),
  Permission.delete(Role.user(accountId)),
  Permission.write(Role.user(accountId)),
];

export const userToAnyUpdate = (accountId: string) => [
  Permission.read(Role.any()),
  Permission.delete(Role.user(accountId)),
  Permission.write(Role.user(accountId)),
  Permission.update(Role.any()),
];
