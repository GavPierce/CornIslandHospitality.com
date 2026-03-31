import { getHouses } from '@/actions/housing';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
    const houses = await getHouses();
    return <CalendarClient houses={houses} />;
}
