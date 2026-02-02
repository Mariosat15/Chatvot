"use client";

import { useEffect, useState, Suspense } from "react";
import { CheckCircle, XCircle, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerificationStatus = "loading" | "approved" | "pending" | "declined" | "error";

function KYCCallbackContent() {
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/kyc/status", { cache: "no-store" });
        const data = await response.json();
        
        if (data.userStatus?.status === "approved") {
          setStatus("approved");
        } else if (data.userStatus?.status === "declined") {
          setStatus("declined");
        } else if (data.userStatus?.status === "pending" || data.userStatus?.status === "submitted") {
          setStatus("pending");
        } else {
          setStatus("pending"); // Default to pending if unclear
        }
      } catch (error) {
        console.error("Error checking KYC status:", error);
        setStatus("pending"); // Assume pending on error
      }
    };

    checkStatus();
  }, []);

  // Auto-close countdown for approved status
  useEffect(() => {
    if (status === "approved" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [status, countdown]);

  const handleClose = () => {
    // Try to close the window
    window.close();
    // If window.close() doesn't work (not opened by script), redirect to profile
    setTimeout(() => {
      window.location.href = "/profile?tab=verification";
    }, 100);
  };

  const handleViewProfile = () => {
    window.location.href = "/profile?tab=verification";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
          {/* Loading State */}
          {status === "loading" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Checking Verification Status
              </h1>
              <p className="text-gray-400">
                Please wait while we confirm your verification...
              </p>
            </>
          )}

          {/* Approved State */}
          {status === "approved" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center animate-pulse">
                <CheckCircle className="w-12 h-12 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Verification Complete!
              </h1>
              <p className="text-green-400 font-medium mb-4">
                Your identity has been successfully verified
              </p>
              <p className="text-gray-400 text-sm mb-6">
                You can now close this window and return to the main application.
                Your verification status has been updated.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleClose}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Window {countdown > 0 && `(${countdown})`}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleViewProfile}
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  View Profile
                </Button>
              </div>
            </>
          )}

          {/* Pending State */}
          {status === "pending" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-12 h-12 text-yellow-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Verification In Progress
              </h1>
              <p className="text-yellow-400 font-medium mb-4">
                Your documents are being reviewed
              </p>
              <p className="text-gray-400 text-sm mb-6">
                This usually takes a few minutes. You can close this window now - 
                we'll notify you once the verification is complete.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleClose}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Window
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleViewProfile}
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Check Status on Profile
                </Button>
              </div>
            </>
          )}

          {/* Declined State */}
          {status === "declined" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Verification Declined
              </h1>
              <p className="text-red-400 font-medium mb-4">
                We couldn't verify your identity
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Please ensure your documents are clear and valid, then try again.
                If you continue to have issues, contact support.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleViewProfile}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Window
                </Button>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Powered by Veriff • Secure Identity Verification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Loading...
          </h1>
          <p className="text-gray-400">
            Please wait...
          </p>
        </div>
      </div>
    </div>
  );
}

// Main page component wrapped in Suspense
export default function KYCCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <KYCCallbackContent />
    </Suspense>
  );
}
