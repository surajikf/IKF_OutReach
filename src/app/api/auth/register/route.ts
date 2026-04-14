import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isPrimaryAdminEmail } from "@/lib/auth-primary";

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // No restricted registration - open to all users


        const supabase = await createClient();

        // 1. Sign up user in Supabase Auth (only primary email allowed above)
        const isSuperAdmin = isPrimaryAdminEmail(email);
        const role = isSuperAdmin ? "ADMIN" : "USER";
        const status = "APPROVED"; // Everyone is pre-authorized

        let supabaseUserId;

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role,
                    status: status,
                },
            },
        });

        if (signUpError) {
            // If the user already exists in Supabase, we might just want to sync Prisma and log them in. 
            // signUpError.message might say "User already registered"
            if (signUpError.message.includes("already registered")) {
                // Try logging them in to get their UUID if they already exist
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (signInError) {
                    return NextResponse.json({ error: "Email is already registered. Please login with correct credentials." }, { status: 400 });
                }
                
                supabaseUserId = signInData.user.id;
            } else {
                return NextResponse.json({ error: signUpError.message }, { status: 400 });
            }
        } else {
            if (!data.user) {
                return NextResponse.json({ error: "Failed to create neural identity." }, { status: 500 });
            }
            supabaseUserId = data.user.id;
        }

        // 3. Sync with public.User table via Prisma (Upsert to prevent P2002 crashes)
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                id: supabaseUserId,
                name,
            },
            create: {
                id: supabaseUserId,
                name,
                email,
                role,
                status,
            },
        });

        return NextResponse.json(
            { 
                message: "Neural profile synced successfully.", 
                user: { id: user.id, email: user.email, role: user.role, status: user.status },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Registration error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
