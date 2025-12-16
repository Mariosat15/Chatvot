import {inngest} from "@/lib/inngest/client";
import {PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendWelcomeEmail, sendInvoiceEmail} from "@/lib/nodemailer";
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import { checkMarginCalls } from '@/lib/actions/trading/position.actions';
import EmailTemplate from '@/database/models/email-template.model';
// WebSocket disabled - requires paid Massive.com plan (error 1008)
// import { initializeWebSocket, getConnectionStatus } from '@/lib/services/websocket-price-streamer';

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        // Fetch email template settings from database
        const templateSettings = await step.run('get-email-template', async () => {
            await connectToDatabase();
            const template = await EmailTemplate.findOne({ templateType: 'welcome' });
            return {
                useAIPersonalization: template?.useAIPersonalization ?? true,
                aiPersonalizationPrompt: template?.aiPersonalizationPrompt || PERSONALIZED_WELCOME_EMAIL_PROMPT,
                defaultIntro: template?.introText || 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.',
                isActive: template?.isActive ?? true,
            };
        });

        // Check if welcome emails are disabled
        if (!templateSettings.isActive) {
            console.log('📧 Welcome email is disabled in settings, skipping...');
            return {
                success: true,
                message: 'Welcome email skipped (disabled in settings)',
                skipped: true,
            };
        }

        let introText = templateSettings.defaultIntro;

        // Only use AI if enabled in settings
        if (templateSettings.useAIPersonalization) {
            const userProfile = `
                - Country: ${event.data.country || 'Not specified'}
            `;

            // Use the prompt from database or fallback to default
            const prompt = templateSettings.aiPersonalizationPrompt.replace('{{userProfile}}', userProfile);

            try {
                const response = await step.ai.infer('generate-welcome-intro', {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: {
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    { text: prompt }
                                ]
                            }
                        ]
                    }
                });

                const part = response.candidates?.[0]?.content?.parts?.[0];
                const aiGeneratedText = part && 'text' in part ? part.text : null;
                
                if (aiGeneratedText) {
                    introText = aiGeneratedText;
                    console.log('✨ AI generated personalized intro text');
                }
            } catch (error) {
                console.error('⚠️ AI personalization failed, using default intro:', error);
                // Fall back to default intro text
            }
        } else {
            console.log('📧 AI personalization disabled, using default intro');
        }

        await step.run('send-welcome-email', async () => {
            const { data: { email, name } } = event;
            return await sendWelcomeEmail({ email, name, intro: introText });
        });

        return {
            success: true,
            message: 'Welcome email sent successfully',
            aiPersonalized: templateSettings.useAIPersonalization,
        };
    }
);

// Update competition statuses based on time
export const updateCompetitionStatuses = inngest.createFunction(
    { 
        id: 'update-competition-statuses',
        concurrency: { limit: 1 }, // Only 1 instance at a time
    },
    { cron: '* * * * *' }, // Run every minute
    async ({ step }) => {
        return await step.run('update-statuses', async () => {
            const { checkAndFinalizeCompetitions } = await import('@/lib/actions/trading/competition-end.actions');
            await connectToDatabase();
            
            const now = new Date();
            let updatedCount = 0;

            // Log all upcoming competitions with their start times
            const upcomingCompetitions = await Competition.find({ status: 'upcoming' }).select('name startTime participants');
            console.log(`⏰ Current UTC time: ${now.toISOString()}`);
            console.log(`📋 Upcoming competitions:`, upcomingCompetitions.map(c => ({
                name: c.name,
                startTime: new Date(c.startTime).toISOString(),
                shouldStart: new Date(c.startTime) <= now
            })));

            // Send "starting soon" notifications (15 minutes before start)
            const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
            const startingSoonCompetitions = upcomingCompetitions.filter(c => {
                const startTime = new Date(c.startTime);
                const timeDiff = startTime.getTime() - now.getTime();
                // Between 14-15 minutes from now (to avoid sending multiple times)
                return timeDiff > 14 * 60 * 1000 && timeDiff <= 15 * 60 * 1000;
            });

            if (startingSoonCompetitions.length > 0) {
                try {
                    const { notificationService } = await import('@/lib/services/notification.service');
                    for (const comp of startingSoonCompetitions) {
                        const participants = comp.participants || [];
                        const startTime = new Date(comp.startTime).toLocaleTimeString();
                        for (const participant of participants) {
                            const userId = typeof participant === 'string' 
                                ? participant 
                                : (participant.userId?.toString() || participant.toString());
                            await notificationService.notifyCompetitionStartingSoon(
                                userId,
                                comp._id.toString(),
                                comp.name,
                                startTime
                            );
                        }
                        console.log(`🔔 Sent competition_starting_soon to ${participants.length} participants for ${comp.name}`);
                    }
                } catch (notifError) {
                    console.error('Error sending starting soon notifications:', notifError);
                }
            }

            // Send "ending soon" notifications for active competitions (15 minutes before end)
            const activeCompetitions = await Competition.find({ status: 'active' }).select('_id name endTime participants');
            const endingSoonCompetitions = activeCompetitions.filter(c => {
                const endTime = new Date(c.endTime);
                const timeDiff = endTime.getTime() - now.getTime();
                // Between 14-15 minutes from now (to avoid sending multiple times)
                return timeDiff > 14 * 60 * 1000 && timeDiff <= 15 * 60 * 1000;
            });

            if (endingSoonCompetitions.length > 0) {
                try {
                    const { notificationService } = await import('@/lib/services/notification.service');
                    for (const comp of endingSoonCompetitions) {
                        const participants = comp.participants || [];
                        const endTime = new Date(comp.endTime).toLocaleTimeString();
                        for (const participant of participants) {
                            const userId = typeof participant === 'string' 
                                ? participant 
                                : (participant.userId?.toString() || participant.toString());
                            await notificationService.notifyCompetitionEndingSoon(
                                userId,
                                comp._id.toString(),
                                comp.name,
                                endTime
                            );
                        }
                        console.log(`🔔 Sent competition_ending_soon to ${participants.length} participants for ${comp.name}`);
                    }
                } catch (notifError) {
                    console.error('Error sending ending soon notifications:', notifError);
                }
            }

            // Find competitions that should start
            const competitionsToStart = await Competition.find({
                status: 'upcoming',
                startTime: { $lte: now },
            }).select('_id name participants minParticipants currentParticipants entryFee prizePool');

            let cancelledCount = 0;
            let startedCount = 0;
            const competitionsStarting: typeof competitionsToStart = [];

            // Check each competition for minimum participants
            for (const comp of competitionsToStart) {
                const participantCount = comp.currentParticipants || (comp.participants?.length || 0);
                const minRequired = comp.minParticipants || 2;

                console.log(`📊 Competition "${comp.name}": ${participantCount}/${minRequired} participants`);

                if (participantCount < minRequired) {
                    // Cancel the competition - not enough participants
                    console.log(`🚫 CANCELLING "${comp.name}" - only ${participantCount} participants, need ${minRequired}`);
                    
                    await Competition.findByIdAndUpdate(comp._id, {
                        $set: { 
                            status: 'cancelled',
                            cancellationReason: `Did not meet minimum participants requirement (${participantCount}/${minRequired})`
                        }
                    });

                    // Refund all participants
                    try {
                        const { cancelCompetitionAndRefund } = await import('@/lib/actions/trading/competition-cancel.actions');
                        await cancelCompetitionAndRefund(
                            comp._id.toString(),
                            `Competition cancelled - did not meet minimum ${minRequired} participants`
                        );
                        console.log(`💰 Refunded ${participantCount} participants for "${comp.name}"`);
                    } catch (refundError) {
                        console.error(`❌ Error refunding participants for "${comp.name}":`, refundError);
                    }

                    cancelledCount++;
                } else {
                    // Start the competition normally
                    await Competition.findByIdAndUpdate(comp._id, {
                        $set: { status: 'active' }
                    });
                    competitionsStarting.push(comp);
                    startedCount++;
                    console.log(`✅ Started "${comp.name}" with ${participantCount} participants`);
                }
            }

            updatedCount += startedCount;

            // Send competition_started notifications to all participants
            if (competitionsStarting.length > 0) {
                try {
                    const { notificationService } = await import('@/lib/services/notification.service');
                    for (const comp of competitionsStarting) {
                        const participants = comp.participants || [];
                        for (const participant of participants) {
                            const userId = typeof participant === 'string' 
                                ? participant 
                                : (participant.userId?.toString() || participant.toString());
                            await notificationService.notifyCompetitionStarted(
                                userId,
                                comp._id.toString(),
                                comp.name
                            );
                        }
                        console.log(`🔔 Sent competition_started notifications to ${participants.length} participants for ${comp.name}`);
                    }
                } catch (notifError) {
                    console.error('Error sending competition started notifications:', notifError);
                }
            }

            // Finalize active → completed (when endTime has passed)
            // This will close all positions and distribute prizes
            const finalizationResult = await checkAndFinalizeCompetitions();

            // ========== 1v1 CHALLENGE STATUS UPDATES ==========
            let challengesExpired = 0;
            let challengesFinalized = 0;

            try {
                const { finalizeEndedChallenges, expirePendingChallenges } = await import('@/lib/actions/trading/challenge-finalize.actions');
                
                // Expire pending challenges that passed deadline
                const expireResult = await expirePendingChallenges();
                challengesExpired = expireResult.expired;
                
                // Finalize completed challenges
                const challengeResult = await finalizeEndedChallenges();
                challengesFinalized = challengeResult.finalized;
                
                if (challengesExpired > 0 || challengesFinalized > 0) {
                    console.log(`⚔️ Challenge status update: ${challengesExpired} expired, ${challengesFinalized} finalized`);
                }
            } catch (challengeError) {
                console.error('Error updating challenge statuses:', challengeError);
            }

            console.log(`✅ Competition status update: ${startedCount} started, ${cancelledCount} cancelled, finalization result:`, finalizationResult);

            return {
                success: true,
                message: `Updated competitions and challenges`,
                competitions: {
                    started: startedCount,
                    cancelled: cancelledCount,
                    finalized: finalizationResult.results?.length || 0,
                },
                challenges: {
                    expired: challengesExpired,
                    finalized: challengesFinalized,
                },
                finalizationDetails: finalizationResult,
            };
        });
    }
);

// Monitor margin levels and automatically liquidate positions if needed
export const monitorMarginLevels = inngest.createFunction(
    { 
        id: 'monitor-margin-levels',
        concurrency: { limit: 1 }, // Only 1 instance at a time - prevents resource starvation
        rateLimit: { limit: 2, period: '1m' }, // Max 2 runs per minute
    },
    { cron: '* * * * *' }, // Run every minute, then check multiple times based on admin settings
    async ({ step }) => {
        return await step.run('check-margin-levels', async () => {
            await connectToDatabase();
            
            // Load admin settings to get check interval
            const TradingRiskSettings = (await import('@/database/models/trading-risk-settings.model')).default;
            const settings = await (TradingRiskSettings as any).getSingleton();
            const checkIntervalSeconds = settings?.marginCheckIntervalSeconds || 60;
            
            console.log(`🔄 Starting margin monitoring with ${checkIntervalSeconds}s interval`);
            
            // Calculate how many checks to perform in this minute
            const checksPerMinute = Math.max(1, Math.floor(60 / checkIntervalSeconds));
            const actualInterval = 60 / checksPerMinute; // Actual seconds between checks
            
            console.log(`📊 Will perform ${checksPerMinute} checks (every ${actualInterval.toFixed(1)}s)`);
            
            // Get all active competitions
            const activeCompetitions = await Competition.find({
                status: 'active',
            }).select('_id slug').lean();

            // Get all active challenges too
            const Challenge = (await import('@/database/models/trading/challenge.model')).default;
            const activeChallenges = await Challenge.find({
                status: 'active',
            }).select('_id slug').lean();

            if ((!activeCompetitions || activeCompetitions.length === 0) && 
                (!activeChallenges || activeChallenges.length === 0)) {
                return {
                    success: true,
                    message: 'No active competitions or challenges to monitor',
                };
            }

            let totalChecks = 0;

            // Perform multiple checks based on interval setting
            for (let i = 0; i < checksPerMinute; i++) {
                console.log(`\n🔍 Check ${i + 1}/${checksPerMinute} at ${new Date().toISOString()}`);
                
                // Check margin for each competition
                for (const competition of activeCompetitions) {
                    try {
                        const competitionId = String((competition as any)._id);
                        await checkMarginCalls(competitionId);
                        totalChecks++;
                    } catch (error) {
                        console.error(`Error checking margins for competition ${(competition as any).slug}:`, error);
                    }
                }

                // Check margin for each challenge (reuses same function - challengeId works as competitionId)
                for (const challenge of activeChallenges) {
                    try {
                        const challengeId = String((challenge as any)._id);
                        await checkMarginCalls(challengeId);
                        totalChecks++;
                    } catch (error) {
                        console.error(`Error checking margins for challenge ${(challenge as any)._id}:`, error);
                    }
                }

                // Wait before next check (except on last iteration)
                if (i < checksPerMinute - 1) {
                    await new Promise(resolve => setTimeout(resolve, actualInterval * 1000));
                }
            }

            return {
                success: true,
                message: `Performed ${totalChecks} margin checks across ${activeCompetitions.length} competition(s) and ${activeChallenges.length} challenge(s)`,
                competitions: activeCompetitions.length,
                challenges: activeChallenges.length,
                checksPerformed: totalChecks,
                checkInterval: `${actualInterval.toFixed(1)}s`,
            };
        });
    }
);

/**
 * Evaluate badges for all users
 * Runs every hour to check if users earned new badges
 */
export const evaluateUserBadges = inngest.createFunction(
    { id: 'chatvolt-evaluate-badges' },
    { cron: '0 * * * *' }, // Every hour
    async () => {
        const { evaluateUserBadges: evaluateBadges } = await import('@/lib/services/badge-evaluation.service');
        const { default: CompetitionParticipant } = await import('@/database/models/trading/competition-participant.model');
        await connectToDatabase();
        
        console.log(`🏅 Starting badge evaluation at ${new Date().toISOString()}`);
        
        try {
            // Get all users who have participated in competitions
            const uniqueUsers = await CompetitionParticipant.distinct('userId');
            
            console.log(`📊 Found ${uniqueUsers.length} users to evaluate`);
            
            let totalNewBadges = 0;
            let usersWithNewBadges = 0;
            
            // Evaluate badges for each user
            for (const userId of uniqueUsers) {
                try {
                    const result = await evaluateBadges(userId);
                    if (result.newBadges.length > 0) {
                        totalNewBadges += result.newBadges.length;
                        usersWithNewBadges++;
                        console.log(`✨ User ${userId} earned ${result.newBadges.length} new badges`);
                    }
                } catch (error) {
                    console.error(`Error evaluating badges for user ${userId}:`, error);
                }
            }
            
            console.log(`✅ Badge evaluation complete: ${totalNewBadges} new badges awarded to ${usersWithNewBadges} users`);
            
            return {
                success: true,
                message: `Evaluated ${uniqueUsers.length} users, awarded ${totalNewBadges} new badges`,
                usersEvaluated: uniqueUsers.length,
                newBadgesAwarded: totalNewBadges,
                usersWithNewBadges,
            };
        } catch (error) {
            console.error('Error in badge evaluation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
);

/**
 * Server-side price cache updater
 * Fetches all forex prices every 3 seconds and caches them
 * This way, API requests read from cache (instant) instead of making external calls
 * 
 * Benefits:
 * - Single source fetches prices (not every user)
 * - API reads are instant (from cache)
 * - Reduces Massive.com API calls by 90%+
 */
export const updatePriceCache = inngest.createFunction(
    { 
        id: 'update-price-cache',
        concurrency: { limit: 1 }, // Only 1 instance
    },
    { cron: '*/5 * * * * *' }, // Every 5 seconds
    async () => {
        const { fetchRealForexPrices } = await import('@/lib/services/real-forex-prices.service');
        type ForexSymbolType = import('@/lib/services/pnl-calculator.service').ForexSymbol;
        
        // All forex pairs to cache
        const allPairs: ForexSymbolType[] = [
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
            'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD',
            'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
            'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
            'CAD/JPY', 'CAD/CHF', 'CHF/JPY',
            'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
            'USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK',
        ];
        
        try {
            const startTime = Date.now();
            const prices = await fetchRealForexPrices(allPairs);
            const duration = Date.now() - startTime;
            
            console.log(`💰 Price cache updated: ${prices.size} pairs in ${duration}ms`);
            
            return {
                success: true,
                pairsUpdated: prices.size,
                durationMs: duration,
            };
        } catch (error) {
            console.error('❌ Failed to update price cache:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
);

/**
 * Send invoice email after credit purchase
 * Triggered by app/invoice.created event
 */
export const sendInvoiceEmailJob = inngest.createFunction(
    { id: 'send-invoice-email' },
    { event: 'app/invoice.created' },
    async ({ event, step }) => {
        const { invoiceId, customerEmail, customerName, invoiceNumber } = event.data;
        
        console.log(`📧 [INVOICE] Sending invoice email for ${invoiceNumber} to ${customerEmail}`);
        
        await step.run('send-invoice-email', async () => {
            try {
                await sendInvoiceEmail({
                    invoiceId,
                    customerEmail,
                    customerName,
                });
                
                console.log(`✅ [INVOICE] Email sent successfully for ${invoiceNumber}`);
                
                return {
                    success: true,
                    message: `Invoice email sent to ${customerEmail}`,
                };
            } catch (error) {
                console.error('❌ [INVOICE] Error sending invoice email:', error);
                throw error;
            }
        });
        
        return {
            success: true,
            invoiceNumber,
            customerEmail,
        };
    }
);

