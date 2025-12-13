'use client';
import { useEffect, useRef } from "react";

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        // Debug log
        console.log('🔄 Loading TradingView Widget:', scriptUrl.split('/').pop());
        
        // Clear all existing content
        container.innerHTML = '';
        
        // Create the widget container div
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = `${height}px`;
        widgetDiv.style.width = '100%';
        
        // Create the script element
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = scriptUrl;
        script.async = true;
        script.innerHTML = JSON.stringify(config);
        
        // Append both to container
        container.appendChild(widgetDiv);
        container.appendChild(script);
        
        console.log('✅ TradingView Widget loaded');

        // Cleanup
        return () => {
            console.log('🧹 Cleaning up TradingView Widget');
            if (container) {
                container.innerHTML = '';
            }
        }
    }, [scriptUrl, config, height])

    return containerRef;
}
export default useTradingViewWidget
