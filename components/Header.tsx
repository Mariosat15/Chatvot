import Link from "next/link";
import Image from "next/image";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";

const Header = async ({ user }: { user: User }) => {
    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/dashboard">
                    <Image src="/assets/icons/logo.svg" alt="chatvolt logo" width={140} height={32} priority className="cursor-pointer" style={{ width: 'auto', height: '32px' }} />
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
