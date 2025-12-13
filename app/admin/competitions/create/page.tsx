import { Trophy, ArrowLeft, Sparkles } from 'lucide-react';
import CompetitionCreatorForm from '@/components/admin/CompetitionCreatorForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const CreateCompetitionPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      {/* Enhanced Header */}
      <div className="border-b border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-300">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="h-8 w-px bg-gray-700"></div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50"></div>
                  <div className="relative h-12 w-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-xl">
                    <Trophy className="h-6 w-6 text-gray-900" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-400 bg-clip-text text-transparent flex items-center gap-2">
                    Create New Competition
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                  </h1>
                  <p className="text-sm text-gray-400">
                    Configure and launch a new trading competition
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CompetitionCreatorForm />
      </div>
    </div>
  );
};

export default CreateCompetitionPage;

