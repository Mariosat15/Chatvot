import Link from "next/link";
import Image from "next/image";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {connectToDatabase} from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";

// Fetch auth page settings from database
async function getAuthPageSettings() {
    try {
        await connectToDatabase();
        const settings = await HeroSettings.findOne().select({
            authPageTestimonialText: 1,
            authPageTestimonialAuthor: 1,
            authPageTestimonialRole: 1,
            authPageTestimonialRating: 1,
            authPageDashboardImage: 1,
            logo: 1,
        }).lean();

        return {
            testimonialText: settings?.authPageTestimonialText || 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
            testimonialAuthor: settings?.authPageTestimonialAuthor || 'Ethan R.',
            testimonialRole: settings?.authPageTestimonialRole || 'Retail Investor',
            // Use ?? instead of || so that explicit 0 rating (to hide stars) is respected
            testimonialRating: settings?.authPageTestimonialRating ?? 5,
            dashboardImage: settings?.authPageDashboardImage || '/assets/images/dashboard.png',
            logo: settings?.logo || '/assets/icons/logo.svg',
        };
    } catch (error) {
        console.error('Failed to load auth page settings:', error);
        return {
            testimonialText: 'chatvolt turned my watchlist into a winning list. The alerts are spot-on, and I feel more confident making moves in the market',
            testimonialAuthor: 'Ethan R.',
            testimonialRole: 'Retail Investor',
            testimonialRating: 5,
            dashboardImage: '/assets/images/dashboard.png',
            logo: '/assets/icons/logo.svg',
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
