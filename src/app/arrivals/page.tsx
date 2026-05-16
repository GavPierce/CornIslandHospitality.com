import { getVolunteers } from '@/actions/housing';
import { getUserRole, requireElevatedAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ArrivalsClient from './ArrivalsClient';

export const dynamic = 'force-dynamic';

export default async function ArrivalsPage() {
    const error = await requireElevatedAccess();
    if (error) redirect('/');
    const volunteers = await getVolunteers();
    const role = await getUserRole();
    return <ArrivalsClient volunteers={volunteers} role={role} />;
}
