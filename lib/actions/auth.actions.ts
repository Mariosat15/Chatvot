'use server';

import {auth} from "@/lib/better-auth/auth";
import {inngest} from "@/lib/inngest/client";
import {headers} from "next/headers";
import {connectToDatabase} from "@/database/mongoose";
import { ObjectId } from 'mongodb';

export const signUpWithEmail = async ({ email, password, fullName, country, address, city, postalCode }: SignUpFormData) => {
    try {
        // SECURITY: Prevent users from signing up with admin email
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';
        if (email.toLowerCase() === adminEmail) {
            return { 
                error: 'This email address is not available for registration',
                success: false 
            };
        }
        
        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } })

        if(response && response.user) {
            // Update user with additional profile fields
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;
            
            if (db) {
                const userId = response.user.id;
                console.log(`📝 Sign-up: Updating user ${userId} with profile data...`);
                
                // Build query to find user by multiple ID formats
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const queries: any[] = [{ id: userId }];
                if (ObjectId.isValid(userId)) {
                    queries.push({ _id: new ObjectId(userId) });
                }
                queries.push({ _id: userId });
                
                // All new users are traders by default
                // Admin role can ONLY be assigned through the admin panel
                const role = 'trader';
                
                const updateResult = await db.collection('user').updateOne(
                    { $or: queries },
                    { 
                        $set: { 
                            country,
                            address,
                            city,
                            postalCode,
                            role, // All signups are traders - admin role assigned via admin panel only
                            updatedAt: new Date()
                        } 
                    }
                );
                
                console.log(`📝 Sign-up: Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
                
                if (updateResult.matchedCount === 0) {
                    console.error(`⚠️ Sign-up: Could not find user to update profile data. userId: ${userId}`);
                } else {
                    console.log(`✅ Sign-up: Profile data saved for user ${userId}`, { country, address, city, postalCode });
                }
            }

            await inngest.send({
                name: 'app/user.created',
                data: { email, name: fullName, country }
            })
        }

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign up failed', e)
        return { success: false, error: 'Sign up failed' }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({ body: { email, password } })

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign in failed', e)
        return { success: false, error: 'Sign in failed' }
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}
