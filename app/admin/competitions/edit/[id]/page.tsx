import { ArrowLeft, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { notFound } from 'next/navigation';
import CompetitionEditorForm from '@/components/admin/CompetitionEditorForm';

interface EditCompetitionPageProps {
  params: Promise<{ id: string }>;
}

async function getCompetition(id: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/competitions/${id}`, {
      cache: 'no-store',
      headers: {
        'Cookie': `admin_token=${process.env.ADMIN_JWT_SECRET}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.competition;
  } catch (error) {
    console.error('Error fetching competition:', error);
    return null;
  }
}

export default async function EditCompetitionPage({ params }: EditCompetitionPageProps) {
  const { id } = await params;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8 lg:p-12">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <Link href="/admin/dashboard?activeTab=competitions" passHref>
          <Button variant="ghost" className="text-gray-400 hover:text-gray-100 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-4 bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30 rounded-xl p-5">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500 rounded-full blur-lg opacity-30"></div>
            <div className="relative h-14 w-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center shadow-xl">
              <Trophy className="h-7 w-7 text-gray-900" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-300 bg-clip-text text-transparent">
              Edit Competition
            </h1>
            <p className="text-gray-400 mt-1">
              Update competition settings and configuration
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <CompetitionEditorForm competitionId={id} />
    </div>
  );
}
