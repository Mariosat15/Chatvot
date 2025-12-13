import { redirect } from 'next/navigation';

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol: _symbol } = await params;
  
  // Redirect to competitions page since we don't need stock detail pages
  redirect('/competitions');
}
