import { getHouses, getVolunteers } from '@/actions/housing';
import { getUserRole, requireElevatedAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PlanningClient from './PlanningClient';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
    const error = await requireElevatedAccess();
    if (error) redirect('/');
    const houses = await getHouses();
    const volunteers = await getVolunteers();
    const role = await getUserRole();
    return <PlanningClient houses={houses} volunteers={volunteers} role={role} />;
}
