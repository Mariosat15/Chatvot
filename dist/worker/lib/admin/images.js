"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhiteLabelImages = getWhiteLabelImages;
exports.getAppLogo = getAppLogo;
exports.getEmailLogo = getEmailLogo;
exports.getProfileImage = getProfileImage;
exports.getDashboardPreview = getDashboardPreview;
exports.clearImageCache = clearImageCache;
const mongoose_1 = require("@/database/mongoose");
const whitelabel_model_1 = require("@/database/models/whitelabel.model");
// Cache for image paths (optional, for performance)
let imageCache = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute
async function getWhiteLabelImages() {
    // Return cached if available and fresh
    if (imageCache && Date.now() - cacheTime < CACHE_DURATION) {
        return imageCache;
    }
    try {
        await (0, mongoose_1.connectToDatabase)();
        const settings = await whitelabel_model_1.WhiteLabel.findOne().lean();
        if (!settings) {
            // Return defaults if no settings exist
            imageCache = {
                appLogo: '/assets/images/logo.png',
                emailLogo: '/assets/images/logo.png',
                profileImage: '/assets/images/PROFILE.png',
                dashboardPreview: '/assets/images/dashboard-preview.png',
            };
        }
        else {
            imageCache = {
                appLogo: settings.appLogo || '/assets/images/logo.png',
                emailLogo: settings.emailLogo || '/assets/images/logo.png',
                profileImage: settings.profileImage || '/assets/images/PROFILE.png',
                dashboardPreview: settings.dashboardPreview || '/assets/images/dashboard-preview.png',
            };
        }
        cacheTime = Date.now();
        return imageCache;
    }
    catch (error) {
        console.error('Error fetching white label images:', error);
        // Return defaults on error
        return {
            appLogo: '/assets/images/logo.png',
            emailLogo: '/assets/images/logo.png',
            profileImage: '/assets/images/PROFILE.png',
            dashboardPreview: '/assets/images/dashboard-preview.png',
        };
    }
}
// Get specific image type
async function getAppLogo() {
    const images = await getWhiteLabelImages();
    return images.appLogo;
}
async function getEmailLogo() {
    const images = await getWhiteLabelImages();
    return images.emailLogo;
}
async function getProfileImage() {
    const images = await getWhiteLabelImages();
    return images.profileImage;
}
async function getDashboardPreview() {
    const images = await getWhiteLabelImages();
    return images.dashboardPreview;
}
// Clear cache (call this after updating images in admin panel)
function clearImageCache() {
    imageCache = null;
    cacheTime = 0;
}
