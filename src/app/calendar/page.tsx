import { getHouses } from '@/actions/housing';
import CalendarClient from './CalendarClient';
import { requireElevatedAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
    const error = await requireElevatedAccess();
    if (error) redirect('/');
    const houses = await getHouses();
    return <CalendarClient houses={houses} />;
}
