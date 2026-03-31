import { getHouses, getVolunteers } from '@/actions/housing';
import PlanningClient from './PlanningClient';

export const dynamic = 'force-dynamic';

export default async function PlanningPage() {
    const houses = await getHouses();
    const volunteers = await getVolunteers();
    return <PlanningClient houses={houses} volunteers={volunteers} />;
}
