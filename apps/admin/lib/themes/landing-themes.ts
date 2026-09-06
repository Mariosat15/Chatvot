// Reason: The admin app must use the SAME theme definitions as the main app.
// Instead of maintaining a duplicate, we re-export everything from the root lib.
// The @root/lib/* path alias maps to ../../lib/* (the main app's lib directory).
export * from "@root/lib/themes/landing-themes";
