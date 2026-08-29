export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

let users: User[] = [];
let nextUserId = 1;

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase();
  return users.find(u => u.email.toLowerCase() === normalized);
}

export function findUserByUsername(username: string): User | undefined {
  return users.find(u => u.username === username);
}

export function findUserById(id: number): User | undefined {
  return users.find(u => u.id === id);
}

export function createUser(username: string, email: string, passwordHash: string): User {
  const user: User = {
    id: nextUserId++,
    username,
    email,
    passwordHash,
    createdAt: new Date(),
  };
  users.push(user);
  return user;
}
