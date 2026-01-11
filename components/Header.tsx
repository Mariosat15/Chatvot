'use client';

import Link from "next/link";
import Image from "next/image";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useState } from "react";

const Header = ({ user }: { user: User }) => {
    const { settings } = useAppSettings();
    const [imgError, setImgError] = useState(false);
    
    // Use dynamic logo from settings, fallback to default
    const logoSrc = !imgError && settings?.branding?.appLogo 
        ? settings.branding.appLogo 
        : '/assets/icons/logo.svg';
    
    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/dashboard">
                    <Image 
                        src={logoSrc} 
                        alt="logo" 
                        width={140} 
                        height={32} 
                        priority 
                        className="cursor-pointer" 
                        style={{ width: 'auto', height: '32px' }}
                        onError={() => setImgError(true)}
                        unoptimized
                    />
                </Link>
                <nav className="hidden sm:block">
                    <NavItems />
                </nav>

                <div className="flex items-center gap-2">
                    <NotificationDropdown />
                    <UserDropdown user={user} />
                </div>
            </div>
        </header>
    )
}
export default Header
