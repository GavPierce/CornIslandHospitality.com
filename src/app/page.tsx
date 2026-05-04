import { getHouses } from '@/actions/housing';
import { getCurrentUser, getUserRole } from '@/lib/auth';
import { getMyLanguage } from '@/actions/preferences';
import { prisma } from '@/lib/prisma';
import type { MyAssignment, MyShift } from './MyScheduleCard';
import DashboardClient from './DashboardClient';
import LanguagePrompt from './LanguagePrompt';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const houses = await getHouses();
  const volunteerCount = await prisma.volunteer.count();
  const assignmentCount = await prisma.assignment.count({
    where: { endDate: { gte: new Date() } },
  });
  const role = await getUserRole();
  const session = await getCurrentUser();

  const totalBeds = houses.reduce(
    (sum: number, h: { rooms: { capacity: number }[] }) =>
      sum + h.rooms.reduce((rs: number, r: { capacity: number }) => rs + r.capacity, 0),
    0
  );

  const maxCapacity = houses.reduce(
    (sum: number, h: { rooms: { capacity: number }[]; acceptedTypes: string[] }) => {
      const multiplier = h.acceptedTypes.includes('MARRIED_COUPLE') ? 2 : 1;
      return sum + h.rooms.reduce((rs: number, r: { capacity: number }) => rs + r.capacity * multiplier, 0);
    },
    0
  );

  // ─── Personalized data for the logged-in user ─────────────
  let myShifts: MyShift[] = [];
  let myAssignments: MyAssignment[] = [];

  if (session?.identityType === 'WATCHMAN') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rows = await prisma.watchmanShift.findMany({
      where: { volunteerId: session.identityId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 10,
    });
    myShifts = rows.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      slot: s.slot,
      notes: s.notes,
    }));
  } else if (session?.identityType === 'VOLUNTEER') {
    const rows = await prisma.assignment.findMany({
      where: { volunteerId: session.identityId, endDate: { gte: new Date() } },
      include: { room: { include: { house: true } } },
      orderBy: { startDate: 'asc' },
    });
    myAssignments = rows.map((a) => ({
      id: a.id,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate.toISOString(),
      roomName: a.room.name,
      houseName: a.room.house.name,
      houseAddress: a.room.house.address,
    }));
  }

  // Show the one-time language prompt only for signed-in users who
  // haven't chosen yet.
  const savedLanguage = session ? await getMyLanguage() : null;
  const needsLanguagePrompt = Boolean(session) && savedLanguage === null;

  return (
    <>
      {needsLanguagePrompt && <LanguagePrompt />}
      <DashboardClient
        houses={houses}
        volunteerCount={volunteerCount}
        activeAssignments={assignmentCount}
        totalBeds={totalBeds}
        maxCapacity={maxCapacity}
        role={role}
        userName={session?.name ?? null}
        identityType={session?.identityType ?? null}
        myShifts={myShifts}
        myAssignments={myAssignments}
      />
    </>
  );
}
