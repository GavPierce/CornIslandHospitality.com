import { getUserRole } from '@/lib/auth';
import { getWatchmen, getWatchmanShifts } from '@/actions/watchman';
import WatchmanClient from './WatchmanClient';

export const dynamic = 'force-dynamic';

export default async function WatchmanPage() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const [watchmen, shifts, role] = await Promise.all([
        getWatchmen(),
        getWatchmanShifts(year, month),
        getUserRole(),
    ]);

    return (
        <WatchmanClient
            watchmen={watchmen}
            initialShifts={shifts}
            initialYear={year}
            initialMonth={month}
            role={role}
        />
    );
}
