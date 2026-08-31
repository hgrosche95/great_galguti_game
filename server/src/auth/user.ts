import { prisma } from '../prisma';

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export function findUserByEmail(email: string): Promise<User | null> {
  // Postgres-Text-Vergleich ist standardmaessig case-sensitive, E-Mails
  // sollen aber case-insensitive eindeutig sein (siehe unique-Constraint-
  // Kommentar in createUser).
  return prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
}

export function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export function findUserById(id: number): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(username: string, email: string, passwordHash: string): Promise<User> {
  return prisma.user.create({ data: { username, email, passwordHash } });
}
