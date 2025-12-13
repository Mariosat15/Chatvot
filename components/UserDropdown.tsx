'use client';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {LogOut, User, HelpCircle, Wallet, ChevronDown} from "lucide-react";
import NavItems from "@/components/NavItems";
import {signOut} from "@/lib/actions/auth.actions";
import { useWhiteLabelImages } from "@/hooks/useWhiteLabelImages";
import Link from "next/link";

const UserDropdown = ({ user }: {user: User}) => {
    const router = useRouter();
    const { images } = useWhiteLabelImages();

    const handleSignOut = async () => {
        await signOut();
        router.push("/sign-in");
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-800/50 border border-transparent hover:border-yellow-500/30 transition-all duration-300 group"
                    suppressHydrationWarning
                >
                    <Avatar className="h-9 w-9 ring-2 ring-gray-700 group-hover:ring-yellow-500/50 transition-all duration-300">
                        <AvatarImage src={images.profileImage} />
                        <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-gray-900 text-sm font-bold">
                            {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start mr-1">
                        <span className='text-sm font-semibold text-gray-100 group-hover:text-yellow-500 transition-colors'>
                            {user?.name || user?.email?.split('@')[0]}
                        </span>
                        <span className='text-xs text-gray-500 group-hover:text-gray-400 transition-colors'>
                            View Profile
                        </span>
                    </div>
                    <ChevronDown className="hidden md:block h-4 w-4 text-gray-500 group-hover:text-yellow-500 transition-colors" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
                align="end"
                className="w-64 sm:w-72 bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 shadow-2xl shadow-yellow-500/10 rounded-xl p-2 mt-2"
            >
                {/* User Info Header */}
                <DropdownMenuLabel className="p-0 mb-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300">
                        <Avatar className="h-12 w-12 ring-2 ring-yellow-500/30">
                            <AvatarImage src={images.profileImage} />
                            <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-gray-900 font-bold">
                                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className='text-base font-bold text-gray-100 truncate'>
                                {user?.name || 'Trader'}
                            </span>
                            <span className="text-xs text-gray-400 truncate">{user?.email}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator className="bg-gray-700/50 my-2"/>
                
                {/* Menu Items */}
                <Link href="/profile">
                    <DropdownMenuItem className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-100 font-medium hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-transparent hover:text-yellow-500 cursor-pointer border border-transparent hover:border-yellow-500/30 transition-all duration-300 mb-1">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                            <User className="h-4 w-4 text-blue-500" />
                        </div>
                        <span className="flex-1">Profile</span>
                    </DropdownMenuItem>
                </Link>
                
                <Link href="/wallet">
                    <DropdownMenuItem className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-100 font-medium hover:bg-gradient-to-r hover:from-green-500/20 hover:to-transparent hover:text-green-500 cursor-pointer border border-transparent hover:border-green-500/30 transition-all duration-300 mb-1">
                        <div className="p-1.5 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                            <Wallet className="h-4 w-4 text-green-500" />
                        </div>
                        <span className="flex-1">Wallet</span>
                    </DropdownMenuItem>
                </Link>
                
                <Link href="/help/competitions">
                    <DropdownMenuItem className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-100 font-medium hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-transparent hover:text-purple-500 cursor-pointer border border-transparent hover:border-purple-500/30 transition-all duration-300 mb-1">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                            <HelpCircle className="h-4 w-4 text-purple-500" />
                        </div>
                        <span className="flex-1">Help</span>
                    </DropdownMenuItem>
                </Link>
                
                <DropdownMenuSeparator className="bg-gray-700/50 my-2"/>
                
                {/* Logout */}
                <DropdownMenuItem 
                    onClick={handleSignOut} 
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-100 font-medium hover:bg-gradient-to-r hover:from-red-500/20 hover:to-transparent hover:text-red-500 cursor-pointer border border-transparent hover:border-red-500/30 transition-all duration-300"
                >
                    <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                        <LogOut className="h-4 w-4 text-red-500" />
                    </div>
                    <span className="flex-1">Logout</span>
                </DropdownMenuItem>
                
                {/* Mobile Navigation */}
                <div className="sm:hidden">
                    <DropdownMenuSeparator className="bg-gray-700/50 my-2"/>
                    <nav className="px-1">
                        <NavItems />
                    </nav>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
export default UserDropdown
