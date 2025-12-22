"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = exports.formatCurrency = exports.getFormattedTodayDate = exports.getAlertText = exports.formatDateToday = exports.formatPrice = exports.getChangeColorClass = exports.formatChangePercent = exports.formatArticle = exports.getTodayString = exports.validateArticle = exports.calculateNewsDistribution = exports.getTodayDateRange = exports.getDateRange = exports.formatTimeAgo = void 0;
exports.cn = cn;
exports.delay = delay;
exports.formatMarketCapValue = formatMarketCapValue;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diffInMs = now - timestamp * 1000; // Convert to milliseconds
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    if (diffInHours > 24) {
        const days = Math.floor(diffInHours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    else if (diffInHours >= 1) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    else {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
};
exports.formatTimeAgo = formatTimeAgo;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Formatted string like "$3.10T", "$900.00B", "$25.00M" or "$999,999.99"
function formatMarketCapValue(marketCapUsd) {
    if (!Number.isFinite(marketCapUsd) || marketCapUsd <= 0)
        return 'N/A';
    if (marketCapUsd >= 1e12)
        return `$${(marketCapUsd / 1e12).toFixed(2)}T`; // Trillions
    if (marketCapUsd >= 1e9)
        return `$${(marketCapUsd / 1e9).toFixed(2)}B`; // Billions
    if (marketCapUsd >= 1e6)
        return `$${(marketCapUsd / 1e6).toFixed(2)}M`; // Millions
    return `$${marketCapUsd.toFixed(2)}`; // Below one million, show full USD amount
}
const getDateRange = (days) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);
    return {
        to: toDate.toISOString().split('T')[0],
        from: fromDate.toISOString().split('T')[0],
    };
};
exports.getDateRange = getDateRange;
// Get today's date range (from today to today)
const getTodayDateRange = () => {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    return {
        to: todayString,
        from: todayString,
    };
};
exports.getTodayDateRange = getTodayDateRange;
// Calculate news per symbol based on watchlist size
const calculateNewsDistribution = (symbolsCount) => {
    let itemsPerSymbol;
    let targetNewsCount = 6;
    if (symbolsCount < 3) {
        itemsPerSymbol = 3; // Fewer symbols, more news each
    }
    else if (symbolsCount === 3) {
        itemsPerSymbol = 2; // Exactly 3 symbols, 2 news each = 6 total
    }
    else {
        itemsPerSymbol = 1; // Many symbols, 1 news each
        targetNewsCount = 6; // Don't exceed 6 total
    }
    return { itemsPerSymbol, targetNewsCount };
};
exports.calculateNewsDistribution = calculateNewsDistribution;
// Check for required article fields
const validateArticle = (article) => article.headline && article.summary && article.url && article.datetime;
exports.validateArticle = validateArticle;
// Get today's date string in YYYY-MM-DD format
const getTodayString = () => new Date().toISOString().split('T')[0];
exports.getTodayString = getTodayString;
const formatArticle = (article, isCompanyNews, symbol, index = 0) => ({
    id: isCompanyNews ? Date.now() + Math.random() : (article.id || 0) + index,
    headline: article.headline.trim(),
    summary: article.summary.trim().substring(0, isCompanyNews ? 200 : 150) + '...',
    source: article.source || (isCompanyNews ? 'Company News' : 'Market News'),
    url: article.url,
    datetime: article.datetime,
    image: article.image || '',
    category: isCompanyNews ? 'company' : article.category || 'general',
    related: isCompanyNews ? symbol : article.related || '',
});
exports.formatArticle = formatArticle;
const formatChangePercent = (changePercent) => {
    if (!changePercent)
        return '';
    const sign = changePercent > 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(2)}%`;
};
exports.formatChangePercent = formatChangePercent;
const getChangeColorClass = (changePercent) => {
    if (!changePercent)
        return 'text-gray-400';
    return changePercent > 0 ? 'text-green-500' : 'text-red-500';
};
exports.getChangeColorClass = getChangeColorClass;
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(price);
};
exports.formatPrice = formatPrice;
exports.formatDateToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
});
const getAlertText = (alert) => {
    const condition = alert.alertType === 'upper' ? '>' : '<';
    return `Price ${condition} ${(0, exports.formatPrice)(alert.threshold)}`;
};
exports.getAlertText = getAlertText;
const getFormattedTodayDate = () => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
});
exports.getFormattedTodayDate = getFormattedTodayDate;
// Format currency with proper sign and color
const formatCurrency = (amount) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)}`;
};
exports.formatCurrency = formatCurrency;
// Format date to readable string
const formatDate = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
};
exports.formatDate = formatDate;
