import { getVolunteers } from '@/actions/housing';
import { getUserRole, requireElevatedAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VolunteersClient from './VolunteersClient';

export const dynamic = 'force-dynamic';

export default async function VolunteersPage() {
    const error = await requireElevatedAccess();
    if (error) redirect('/');
    const volunteers = await getVolunteers();
    const role = await getUserRole();
    return <VolunteersClient volunteers={volunteers} role={role} />;
}
