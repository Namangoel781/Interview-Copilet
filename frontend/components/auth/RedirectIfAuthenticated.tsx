"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const token = getAuthToken();
        if (token) {
            router.replace("/dashboard");
        } else {
            setChecking(false);
        }
    }, [router]);

    if (checking) {
        return null; // or a loading spinner
    }

    return <>{children}</>;
}
