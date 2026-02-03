"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAuthToken, api, type ProfileMeOut } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BrainCircuit, UserCircle, LogOut, CheckCircle, Settings, Terminal } from "lucide-react";

export function Navbar() {
    const pathname = usePathname();
    const [token, setToken] = useState<string | null>(null);
    const [me, setMe] = useState<ProfileMeOut | null>(null);

    useEffect(() => {
        // Check for token on mount
        const t = getAuthToken();
        setToken(t);
        if (t) {
            // Optional: fetch user profile for initials/name
            api.profileMe().then(setMe).catch(() => { });
        }
    }, []);

    const handleLogout = () => {
        // Simple logout: clear token and reload/redirect
        window.localStorage.removeItem("access_token");
        window.location.href = "/login";
    };

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Practice", href: "/copilot", icon: BrainCircuit },
        { name: "Simulator", href: "/simulator", icon: Terminal },
        { name: "Quiz", href: "/mcq", icon: CheckCircle },
        { name: "Analyzer", href: "/profile", icon: UserCircle },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <BrainCircuit className="h-5 w-5" />
                    </div>
                    <span>AI <span className="text-primary">Copilot</span></span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "transition-colors hover:text-foreground/80",
                                pathname === item.href ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* Right Side (Auth) */}
                <div className="flex items-center gap-4">
                    {token ? (
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block text-xs text-muted-foreground text-right">
                                <div className="font-medium text-foreground">{me?.email?.split('@')[0] || "User"}</div>
                                <div>{me?.role || "Learning"}</div>
                            </div>
                            <Button variant="ghost" size="icon" asChild title="Setup Profile">
                                <Link href="/profile/setup">
                                    <Settings className="h-5 w-5 text-muted-foreground" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                                <LogOut className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild>
                                <Link href="/login">Login</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/signup">Sign up</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
