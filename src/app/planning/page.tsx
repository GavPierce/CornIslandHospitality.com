import { getHouses, getVolunteers } from '@/actions/housing';
import { getUserRole } from '@/lib/auth';
import PlanningClient from './PlanningClient';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
    const houses = await getHouses();
    const volunteers = await getVolunteers();
    const role = await getUserRole();
    return <PlanningClient houses={houses} volunteers={volunteers} role={role} />;
}
