import { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import LandingPage from "@/database/models/landing-page.model";
import LandingPageRenderer from "./lp-renderer";

interface PageProps {
  params: Promise<{ trackingId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trackingId } = await params;
  await connectToDatabase();

  const page = await LandingPage.findOne({ trackingId, isActive: true }).lean();
  if (!page) return { title: "Not Found" };

  return {
    title: page.seoTitle || page.name,
    description: page.seoDescription || "",
    openGraph: {
      title: page.seoTitle || page.name,
      description: page.seoDescription || "",
      ...(page.ogImage ? { images: [page.ogImage] } : {}),
    },
  };
}

export default async function LandingPageRoute({ params }: PageProps) {
  const { trackingId } = await params;
  await connectToDatabase();

  const page = await LandingPage.findOne({ trackingId, isActive: true }).lean();
  if (!page) notFound();

  // Increment visit count (fire and forget — non-blocking)
  LandingPage.updateOne(
    { _id: page._id },
    { $inc: { totalVisits: 1 } },
  ).exec().catch(() => {});

  // Serialize for client component
  const serializedPage = {
    id: String(page._id),
    name: page.name,
    trackingId: page.trackingId,
    sections: page.sections || [],
    showRiskDisclaimer: page.showRiskDisclaimer,
    customCss: page.customCss || "",
    seoTitle: page.seoTitle || "",
  };

  return <LandingPageRenderer page={serializedPage} />;
}
