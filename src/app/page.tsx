import { getHouses } from '@/actions/housing';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const houses = await getHouses();
  const volunteerCount = await prisma.volunteer.count();
  const assignmentCount = await prisma.assignment.count({
    where: { endDate: { gte: new Date() } },
  });

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

  return (
    <DashboardClient
      houses={houses}
      volunteerCount={volunteerCount}
      activeAssignments={assignmentCount}
      totalBeds={totalBeds}
      maxCapacity={maxCapacity}
    />
  );
}
