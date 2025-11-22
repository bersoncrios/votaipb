import { Injectable, inject } from '@angular/core';
import { Analytics, logEvent, setUserId, setUserProperties } from '@angular/fire/analytics';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private analytics: Analytics = inject(Analytics);

    constructor() {
        console.log('AnalyticsService initialized');
    }

    logEvent(eventName: string, eventParams?: { [key: string]: any }) {
        console.log(`[Analytics] Logging event: ${eventName}`, eventParams);
        logEvent(this.analytics, eventName, eventParams);
    }

    setUserId(userId: string) {
        console.log(`[Analytics] Setting user ID: ${userId}`);
        setUserId(this.analytics, userId);
    }

    setUserProperties(properties: { [key: string]: any }) {
        console.log(`[Analytics] Setting user properties:`, properties);
        setUserProperties(this.analytics, properties);
    }
}
