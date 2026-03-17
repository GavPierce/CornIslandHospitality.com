import { getHouses } from '@/actions/housing';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const houses = await getHouses();
  const volunteerCount = await prisma.volunteer.count();
  const assignmentCount = await prisma.assignment.count({
    where: { endDate: { gte: new Date() } },
  });

  const totalCapacity = houses.reduce(
    (sum: number, h: { rooms: { capacity: number }[] }) =>
      sum + h.rooms.reduce((rs: number, r: { capacity: number }) => rs + r.capacity, 0),
    0
  );

  return (
    <DashboardClient
      houses={houses}
      volunteerCount={volunteerCount}
      activeAssignments={assignmentCount}
      totalCapacity={totalCapacity}
    />
  );
}
