import Link from "next/link";
import Image from "next/image";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {connectToDatabase} from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";

// Fetch auth page settings from database
async function getAuthPageSettings() {
    try {
        await connectToDatabase();
        
        // Fetch testimonial settings from HeroSettings
        const heroSettings = await HeroSettings.findOne().select({
            authPageTestimonialText: 1,
            authPageTestimonialAuthor: 1,
            authPageTestimonialRole: 1,
            authPageTestimonialRating: 1,
            authPageDashboardImage: 1,
        }).lean() as any;
        
        // Fetch branding from WhiteLabel (same source as admin branding settings)
        const whiteLabel = await WhiteLabel.findOne().select({
            appLogo: 1,
        }).lean() as any;

        return {
            testimonialText: heroSettings?.authPageTestimonialText || 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
            testimonialAuthor: heroSettings?.authPageTestimonialAuthor || 'Ethan R.',
            testimonialRole: heroSettings?.authPageTestimonialRole || 'Retail Investor',
            // Use ?? instead of || so that explicit 0 rating (to hide stars) is respected
            testimonialRating: heroSettings?.authPageTestimonialRating ?? 5,
            dashboardImage: heroSettings?.authPageDashboardImage || '/assets/images/dashboard.png',
            // Use appLogo from WhiteLabel (same as admin branding)
            logo: whiteLabel?.appLogo || '/assets/images/logo.png',
        };
    } catch (error) {
        console.error('Failed to load auth page settings:', error);
        return {
            testimonialText: 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
            testimonialAuthor: 'Ethan R.',
            testimonialRole: 'Retail Investor',
            testimonialRating: 5,
            dashboardImage: '/assets/images/dashboard.png',
            logo: '/assets/images/logo.png',
        };
    }
}

const Layout = async ({ children }: { children : React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() })

    if(session?.user) redirect('/')

    const authSettings = await getAuthPageSettings();

    return (
        <main className="auth-layout">
            <section className="auth-left-section scrollbar-hide-default">
                <Link href="/" className="auth-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={authSettings.logo} 
                        alt="logo" 
                        className='h-8 w-auto' 
                    />
                </Link>

                <div className="pb-6 lg:pb-8 flex-1">{children}</div>
            </section>

            <section className="auth-right-section">
                <div className="z-10 relative lg:mt-4 lg:mb-16">
                    <blockquote className="auth-blockquote">
                        {authSettings.testimonialText}
                    </blockquote>
                    <div className="flex items-center justify-between">
                        <div>
                            <cite className="auth-testimonial-author">- {authSettings.testimonialAuthor}</cite>
                            <p className="max-md:text-xs text-gray-500">{authSettings.testimonialRole}</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: authSettings.testimonialRating }, (_, i) => i + 1).map((star) => (
                                <Image src="/assets/icons/star.svg" alt="Star" key={star} width={20} height={20} className="w-5 h-5" />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={authSettings.dashboardImage} 
                        alt="Dashboard Preview" 
                        className="auth-dashboard-preview absolute top-0 w-full max-w-[1440px]" 
                    />
                </div>
            </section>
        </main>
    )
}
export default Layout
