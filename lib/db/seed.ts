import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [insertedUser] = await db
    .insert(users)
    .values({ email, passwordHash, role: 'owner' })
    .$returningId();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, insertedUser.id))
    .limit(1);

  console.log('Initial user created:', user.email);

  const [insertedTeam] = await db
    .insert(teams)
    .values({ name: 'Alp Travel Co.' })
    .$returningId();

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, insertedTeam.id))
    .limit(1);

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  console.log('Seed complete. Team:', team.name);
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
