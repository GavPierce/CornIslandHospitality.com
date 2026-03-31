import { getVolunteers } from '@/actions/housing';
import { getUserRole } from '@/lib/auth';
import VolunteersClient from './VolunteersClient';

export const dynamic = 'force-dynamic';

export default async function VolunteersPage() {
    const volunteers = await getVolunteers();
    const role = await getUserRole();
    return <VolunteersClient volunteers={volunteers} role={role} />;
}
