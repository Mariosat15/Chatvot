import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * Cleanup endpoint for end logic tests
 * Deletes all test data created during testing
 */

export async function POST(request: NextRequest) {
  try {
    const { testDataIds } = await request.json();

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    let deletedCount = 0;

    // ==========================================
    // STEP 1: FIND ALL TEST USER IDS FIRST!
    // (Before deleting anything, collect userIds for side effects cleanup)
    // ==========================================
    const testUserIds: string[] = [];
    const testCompetitionIds: string[] = [];
    const testChallengeIds: string[] = [];

    try {
      console.log("📋 Finding test data to cleanup...");

      // Use string-based regex for better MongoDB compatibility
      const testPattern = { $regex: "TEST_", $options: "i" };
      const testStartPattern = { $regex: "^TEST", $options: "i" };

      // Get user IDs and competition IDs from test participants
      const testParticipants = await db
        .collection("competitionparticipants")
        .find({
          $or: [
            { testRunId: testPattern },
            { username: testPattern },
            { username: testStartPattern },
          ],
        })
        .toArray();
      testParticipants.forEach((p) => {
        if (p.userId) testUserIds.push(p.userId.toString());
        if (p.competitionId)
          testCompetitionIds.push(p.competitionId.toString());
      });
      console.log(
        `   Found ${testParticipants.length} test competition participants`,
      );

      // Get user IDs and challenge IDs from test challenge participants
      const testChallengeParticipants = await db
        .collection("challengeparticipants")
        .find({
          $or: [
            { testRunId: testPattern },
            { username: testPattern },
            { username: testStartPattern },
          ],
        })
        .toArray();
      testChallengeParticipants.forEach((p) => {
        if (p.userId) testUserIds.push(p.userId.toString());
        if (p.challengeId) testChallengeIds.push(p.challengeId.toString());
      });
      console.log(
        `   Found ${testChallengeParticipants.length} test challenge participants`,
      );

      // Get user IDs from test wallets
      const testWallets = await db
        .collection("creditwallets")
        .find({
          testRunId: testPattern,
        })
        .toArray();
      testWallets.forEach((w) => {
        if (w.userId) testUserIds.push(w.userId.toString());
      });
      console.log(`   Found ${testWallets.length} test wallets`);

      // Get GM user IDs from test subscriptions (for referral fee tests)
      const testGmSubs = await db
        .collection("gamemastersubscriptions")
        .find({
          testRunId: testPattern,
        })
        .toArray();
      testGmSubs.forEach((s) => {
        if (s.userId) testUserIds.push(s.userId.toString());
      });
      console.log(`   Found ${testGmSubs.length} test GM subscriptions`);

      // Get user IDs from test referrals (both referred users and GMs)
      const testReferrals = await db
        .collection("userreferrals")
        .find({
          testRunId: testPattern,
        })
        .toArray();
      testReferrals.forEach((r) => {
        if (r.userId) testUserIds.push(r.userId.toString());
        if (r.gameMasterId) testUserIds.push(r.gameMasterId.toString());
      });
      console.log(`   Found ${testReferrals.length} test user referrals`);

      // Get test user IDs directly (test GM users and participants)
      // Check both 'user' (production) and 'users' (legacy) collections
      const testUsersFromUser = await db
        .collection("user")
        .find({
          testRunId: testPattern,
        })
        .toArray();
      testUsersFromUser.forEach((u) => {
        testUserIds.push(u._id.toString());
        if (u.id) testUserIds.push(u.id); // Also track Clerk-style ID
      });
      console.log(
        `   Found ${testUsersFromUser.length} test users from 'user' collection`,
      );

      const testUsersFromUsers = await db
        .collection("users")
        .find({
          testRunId: testPattern,
        })
        .toArray();
      testUsersFromUsers.forEach((u) => {
        testUserIds.push(u._id.toString());
      });
      console.log(
        `   Found ${testUsersFromUsers.length} test users from 'users' collection (legacy)`,
      );

      // Get test competition IDs directly - search by name containing TEST
      const testCompetitions = await db
        .collection("competitions")
        .find({
          $or: [
            { testRunId: testPattern },
            { name: testPattern },
            { name: testStartPattern },
          ],
        })
        .toArray();
      testCompetitions.forEach((c) => {
        testCompetitionIds.push(c._id.toString());
      });
      console.log(`   Found ${testCompetitions.length} test competitions`);

      // Get test challenge IDs directly
      const testChallenges = await db
        .collection("challenges")
        .find({
          $or: [
            { testRunId: testPattern },
            { challengerName: testPattern },
            { challengedName: testPattern },
            { challengerName: testStartPattern },
            { challengedName: testStartPattern },
          ],
        })
        .toArray();
      testChallenges.forEach((c) => {
        testChallengeIds.push(c._id.toString());
      });
      console.log(`   Found ${testChallenges.length} test challenges`);
    } catch (e) {
      console.warn("Error finding test data:", e);
    }

    // Dedupe all IDs
    const uniqueUserIds = [...new Set(testUserIds)];
    const uniqueCompetitionIds = [...new Set(testCompetitionIds)];
    const uniqueChallengeIds = [...new Set(testChallengeIds)];

    console.log(
      `📊 Summary: ${uniqueUserIds.length} users, ${uniqueCompetitionIds.length} competitions, ${uniqueChallengeIds.length} challenges`,
    );

    // ==========================================
    // STEP 2: DELETE BY SPECIFIC IDS (if provided)
    // ==========================================
    if (testDataIds && testDataIds.length > 0) {
      for (const idString of testDataIds) {
        const [collection, id] = idString.split(":");
        if (collection && id) {
          try {
            // Map short names to collection names
            // Note: 'user' maps to 'user' (singular) to match production
            const collectionName =
              collection === "competition"
                ? "competitions"
                : collection === "challenge"
                  ? "challenges"
                  : collection === "participant"
                    ? "competitionparticipants"
                    : collection === "challengeparticipant"
                      ? "challengeparticipants"
                      : collection === "wallet"
                        ? "creditwallets"
                        : collection === "position"
                          ? "tradingpositions"
                          : collection === "user"
                            ? "user" // Changed to 'user' (singular)
                            : collection === "gmsubscription"
                              ? "gamemastersubscriptions"
                              : collection === "gmpackage"
                                ? "marketplaceitems"
                                : collection === "referral"
                                  ? "userreferrals"
                                  : collection === "gmearning"
                                    ? "gamemasterearnings"
                                    : collection;

            const result = await db.collection(collectionName).deleteOne({
              _id: new mongoose.Types.ObjectId(id),
            });
            deletedCount += result.deletedCount;
          } catch (e) {
            console.warn(`Failed to delete ${idString}:`, e);
          }
        }
      }
    }

    // ==========================================
    // STEP 3: DELETE MAIN TEST DATA COLLECTIONS
    // ==========================================
    const mainCollections = [
      "competitions",
      "challenges",
      "competitionparticipants",
      "challengeparticipants",
      "creditwallets",
      "tradingpositions",
      "tradingorders",
      "platformtransactions",
      // GM Referral Fee test data
      "gamemastersubscriptions",
      "gamemasterearnings",
      "userreferrals",
      "user", // Test users - production collection (singular)
      "users", // Test users - legacy collection (plural, for backward compatibility)
    ];

    // Use string-based regex patterns for delete operations
    const testPatternDel = { $regex: "TEST_", $options: "i" };
    const testStartPatternDel = { $regex: "^TEST", $options: "i" };

    for (const collectionName of mainCollections) {
      try {
        // Delete by testRunId field (string contains TEST_)
        const result1 = await db.collection(collectionName).deleteMany({
          testRunId: testPatternDel,
        });
        deletedCount += result1.deletedCount;
        if (result1.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${result1.deletedCount} from ${collectionName} by testRunId`,
          );
        }

        // Also cleanup by isTest flag
        const result2 = await db
          .collection(collectionName)
          .deleteMany({ isTest: true });
        deletedCount += result2.deletedCount;
        if (result2.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${result2.deletedCount} from ${collectionName} by isTest`,
          );
        }

        // SAFE cleanup by specific test patterns
        // Only delete records that CLEARLY look like test data:
        // - Referral codes starting with TESTGM_ (our test format)
        // - Competition/challenge names starting with TEST_ followed by UUID pattern
        // IMPORTANT: Do NOT delete based on user names/emails - real users might have "test" in their name!

        // Skip user-related collections for pattern matching - too risky
        const sensitiveCollections = [
          "user",
          "users",
          "userreferrals",
          "creditwallets",
          "gamemastersubscriptions",
        ];
        if (!sensitiveCollections.includes(collectionName)) {
          // Only match very specific test patterns for non-sensitive collections
          const safeTestPattern = {
            $regex: "^TEST_[a-zA-Z0-9]{8,}",
            $options: "i",
          }; // TEST_ followed by 8+ chars (UUID-like)

          const result3 = await db.collection(collectionName).deleteMany({
            $or: [
              { name: safeTestPattern },
              { slug: { $regex: "^test-test", $options: "i" } }, // Very specific slug pattern
              { challengerName: safeTestPattern },
              { challengedName: safeTestPattern },
              { competitionName: safeTestPattern },
              { challengeName: safeTestPattern },
              // Referral codes for GM test subscriptions (specific format only)
              { referralCode: { $regex: "^TESTGM_", $options: "i" } },
            ],
          });
          deletedCount += result3.deletedCount;
          if (result3.deletedCount > 0) {
            console.log(
              `🗑️ Deleted ${result3.deletedCount} from ${collectionName} by safe test patterns`,
            );
          }
        }
      } catch (e) {
        console.warn(`Failed to cleanup ${collectionName}:`, e);
      }
    }

    // ==========================================
    // EXTRA: Delete platform transactions by competition/challenge ID and description
    // ==========================================
    try {
      // Delete by competition/challenge ID
      if (uniqueCompetitionIds.length > 0 || uniqueChallengeIds.length > 0) {
        const ptResult = await db
          .collection("platformtransactions")
          .deleteMany({
            $or: [
              { competitionId: { $in: uniqueCompetitionIds } },
              { challengeId: { $in: uniqueChallengeIds } },
              {
                sourceId: {
                  $in: [...uniqueCompetitionIds, ...uniqueChallengeIds],
                },
              },
            ],
          });
        if (ptResult.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${ptResult.deletedCount} platform transactions by competition/challenge ID`,
          );
          deletedCount += ptResult.deletedCount;
        }
      }

      // Delete by description containing TEST_
      const ptDescResult = await db
        .collection("platformtransactions")
        .deleteMany({
          $or: [
            { description: testPatternDel },
            { description: testStartPatternDel },
            { source: testPatternDel },
            { notes: testPatternDel },
          ],
        });
      if (ptDescResult.deletedCount > 0) {
        console.log(
          `🗑️ Deleted ${ptDescResult.deletedCount} platform transactions by description pattern`,
        );
        deletedCount += ptDescResult.deletedCount;
      }
    } catch (e) {
      console.warn("Failed to delete platform transactions:", e);
    }

    // ==========================================
    // EXTRA: Delete wallet transactions for test users
    // ==========================================
    try {
      // Delete by userId
      if (uniqueUserIds.length > 0) {
        const wtResult = await db.collection("wallettransactions").deleteMany({
          userId: { $in: uniqueUserIds },
        });
        if (wtResult.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${wtResult.deletedCount} wallet transactions by userId`,
          );
          deletedCount += wtResult.deletedCount;
        }
      }

      // Delete by description containing TEST_
      const wtDescResult = await db
        .collection("wallettransactions")
        .deleteMany({
          $or: [
            { description: testPatternDel },
            { description: testStartPatternDel },
            { source: testPatternDel },
            { notes: testPatternDel },
          ],
        });
      if (wtDescResult.deletedCount > 0) {
        console.log(
          `🗑️ Deleted ${wtDescResult.deletedCount} wallet transactions by description pattern`,
        );
        deletedCount += wtDescResult.deletedCount;
      }
    } catch (e) {
      console.warn("Failed to delete wallet transactions:", e);
    }

    // Extra: Delete by competitionId/challengeId found earlier
    if (uniqueCompetitionIds.length > 0) {
      for (const collName of [
        "competitionparticipants",
        "tradingpositions",
        "tradingorders",
      ]) {
        try {
          const result = await db.collection(collName).deleteMany({
            competitionId: { $in: uniqueCompetitionIds },
          });
          if (result.deletedCount > 0) {
            console.log(
              `🗑️ Deleted ${result.deletedCount} from ${collName} by competitionId`,
            );
            deletedCount += result.deletedCount;
          }
        } catch (e) {
          console.warn(
            `Failed to delete from ${collName} by competitionId:`,
            e,
          );
        }
      }
    }

    if (uniqueChallengeIds.length > 0) {
      for (const collName of [
        "challengeparticipants",
        "tradingpositions",
        "tradingorders",
      ]) {
        try {
          const result = await db.collection(collName).deleteMany({
            $or: [
              { challengeId: { $in: uniqueChallengeIds } },
              { competitionId: { $in: uniqueChallengeIds } },
            ],
          });
          if (result.deletedCount > 0) {
            console.log(
              `🗑️ Deleted ${result.deletedCount} from ${collName} by challengeId`,
            );
            deletedCount += result.deletedCount;
          }
        } catch (e) {
          console.warn(`Failed to delete from ${collName} by challengeId:`, e);
        }
      }
    }

    // ==========================================
    // STEP 4: DELETE SIDE EFFECTS BY USER ID
    // (notifications, badges, levels, wallet transactions)
    // ==========================================
    if (uniqueUserIds.length > 0) {
      console.log(
        `🧹 Cleaning side effects for ${uniqueUserIds.length} test users...`,
      );

      // Delete notifications for test users
      try {
        const notifResult = await db.collection("notifications").deleteMany({
          userId: { $in: uniqueUserIds },
        });
        if (notifResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${notifResult.deletedCount} notifications`);
          deletedCount += notifResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete notifications:", e);
      }

      // Delete badges for test users
      try {
        const badgeResult = await db.collection("userbadges").deleteMany({
          userId: { $in: uniqueUserIds },
        });
        if (badgeResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${badgeResult.deletedCount} user badges`);
          deletedCount += badgeResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete badges:", e);
      }

      // Delete user levels for test users
      try {
        const levelResult = await db.collection("userlevels").deleteMany({
          userId: { $in: uniqueUserIds },
        });
        if (levelResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${levelResult.deletedCount} user levels`);
          deletedCount += levelResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete user levels:", e);
      }

      // Delete wallet transactions for test users
      try {
        const walletTxResult = await db
          .collection("wallettransactions")
          .deleteMany({
            userId: { $in: uniqueUserIds },
          });
        if (walletTxResult.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${walletTxResult.deletedCount} wallet transactions`,
          );
          deletedCount += walletTxResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete wallet transactions:", e);
      }

      // Delete trading orders for test users
      try {
        const orderResult = await db.collection("tradingorders").deleteMany({
          userId: { $in: uniqueUserIds },
        });
        if (orderResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${orderResult.deletedCount} trading orders`);
          deletedCount += orderResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete trading orders:", e);
      }

      // Delete Game Master subscriptions for test users
      try {
        const gmSubResult = await db
          .collection("gamemastersubscriptions")
          .deleteMany({
            userId: { $in: uniqueUserIds },
          });
        if (gmSubResult.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${gmSubResult.deletedCount} GM subscriptions`,
          );
          deletedCount += gmSubResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete GM subscriptions:", e);
      }

      // Delete Game Master earnings for test users
      try {
        const gmEarnResult = await db
          .collection("gamemasterearnings")
          .deleteMany({
            gameMasterId: { $in: uniqueUserIds },
          });
        if (gmEarnResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${gmEarnResult.deletedCount} GM earnings`);
          deletedCount += gmEarnResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete GM earnings:", e);
      }

      // Delete user referrals for test users
      try {
        const refResult = await db.collection("userreferrals").deleteMany({
          $or: [
            { userId: { $in: uniqueUserIds } },
            { gameMasterId: { $in: uniqueUserIds } },
          ],
        });
        if (refResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${refResult.deletedCount} user referrals`);
          deletedCount += refResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete user referrals:", e);
      }
    }

    // ==========================================
    // STEP 5: DELETE GM TEST PACKAGES (marketplace items)
    // ==========================================
    try {
      // SAFE: Only delete marketplace items that are clearly test packages
      const safeTestPackagePattern = {
        $regex: "^TEST_[a-zA-Z0-9]{8,}_GM_Package",
        $options: "i",
      };
      const gmPackageResult = await db
        .collection("marketplaceitems")
        .deleteMany({
          $or: [
            { testRunId: testPatternDel },
            { name: safeTestPackagePattern }, // Only match our specific test package naming format
            { slug: { $regex: "^test-gm-package-test_", $options: "i" } }, // Specific slug format
          ],
        });
      if (gmPackageResult.deletedCount > 0) {
        console.log(
          `🗑️ Deleted ${gmPackageResult.deletedCount} test GM packages`,
        );
        deletedCount += gmPackageResult.deletedCount;
      }
    } catch (e) {
      console.warn("Failed to delete GM packages:", e);
    }

    // Delete GM earnings by competition/challenge ID
    if (uniqueCompetitionIds.length > 0 || uniqueChallengeIds.length > 0) {
      try {
        const gmEarnResult = await db
          .collection("gamemasterearnings")
          .deleteMany({
            sourceId: { $in: [...uniqueCompetitionIds, ...uniqueChallengeIds] },
          });
        if (gmEarnResult.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${gmEarnResult.deletedCount} GM earnings by sourceId`,
          );
          deletedCount += gmEarnResult.deletedCount;
        }
      } catch (e) {
        console.warn("Failed to delete GM earnings by sourceId:", e);
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} total records deleted`);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} test records`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      },
      { status: 500 },
    );
  }
}
