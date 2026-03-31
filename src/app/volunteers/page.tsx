import { getVolunteers } from '@/actions/housing';
import VolunteersClient from './VolunteersClient';

export const dynamic = 'force-dynamic';

export default async function VolunteersPage() {
    const volunteers = await getVolunteers();
    return <VolunteersClient volunteers={volunteers} />;
}
