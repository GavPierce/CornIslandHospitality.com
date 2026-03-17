import { getHouses } from '@/actions/housing';
import CalendarClient from './CalendarClient';

export default async function CalendarPage() {
    const houses = await getHouses();
    return <CalendarClient houses={houses} />;
}
