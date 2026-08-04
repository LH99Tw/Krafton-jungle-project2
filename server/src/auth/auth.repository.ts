import type { User } from './auth.types.js'

export class InMemoryUserRepository {
  private readonly users = new Map<string, User>()
  private nextId = 1
  findByEmail(email: string) { return this.users.get(email) }
  findById(id: number) { return [...this.users.values()].find((user) => user.id === id) }
  create(input: Omit<User, 'id'>) { const user = { id: this.nextId++, ...input }; this.users.set(user.email, user); return user }
}
