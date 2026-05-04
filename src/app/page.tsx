import { getCurrentUser, getUserRole } from '@/lib/auth';
import { getMyLanguage } from '@/actions/preferences';
import { prisma } from '@/lib/prisma';
import type { MyAssignment, MyShift } from './MyScheduleCard';
import type { WatchShift } from './DashboardClient';
import DashboardClient from './DashboardClient';
import LanguagePrompt from './LanguagePrompt';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const volunteerCount = await prisma.volunteer.count();
  const assignmentCount = await prisma.assignment.count({
    where: { endDate: { gte: new Date() } },
  });
  const houseCount = await prisma.house.count();
  const role = await getUserRole();
  const session = await getCurrentUser();

  // ─── Night Watchman schedule (next 7 days) ────────────────
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const rawShifts = await prisma.watchmanShift.findMany({
    where: { date: { gte: today, lt: weekEnd } },
    orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    include: {
      volunteer: { select: { id: true, name: true, phone: true } },
    },
  });

  // Group by date+slot to pair partners together
  const slotMap = new Map<string, typeof rawShifts>();
  for (const s of rawShifts) {
    const key = `${s.date.toISOString()}__${s.slot}`;
    if (!slotMap.has(key)) slotMap.set(key, []);
    slotMap.get(key)!.push(s);
  }

  const watchShifts: WatchShift[] = rawShifts.map((s) => {
    const key = `${s.date.toISOString()}__${s.slot}`;
    const partners = slotMap.get(key)!.filter((p) => p.id !== s.id);
    return {
      id: s.id,
      date: s.date.toISOString(),
      slot: s.slot as WatchShift['slot'],
      notes: s.notes,
      watchmanName: s.volunteer.name,
      watchmanPhone: s.volunteer.phone,
      partners: partners.map((p) => ({
        name: p.volunteer.name,
        phone: p.volunteer.phone,
      })),
    };
  });

  // ─── Personalized data for the logged-in user ─────────────
  let myShifts: MyShift[] = [];
  let myAssignments: MyAssignment[] = [];

  if (session?.identityType === 'WATCHMAN') {
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
        houseCount={houseCount}
        volunteerCount={volunteerCount}
        activeAssignments={assignmentCount}
        role={role}
        userName={session?.name ?? null}
        identityType={session?.identityType ?? null}
        myShifts={myShifts}
        myAssignments={myAssignments}
        watchShifts={watchShifts}
      />
    </>
  );
}
