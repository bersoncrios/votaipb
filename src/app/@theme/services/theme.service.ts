import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private renderer: Renderer2;
    private rendererFactory = inject(RendererFactory2);
    private _isDarkTheme = new BehaviorSubject<boolean>(false);
    public isDarkTheme$ = this._isDarkTheme.asObservable();

    constructor() {
        this.renderer = this.rendererFactory.createRenderer(null, null);
        this.initTheme();
    }

    private initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
    }

    enableDarkMode() {
        this.renderer.addClass(document.body, 'dark-theme');
        this._isDarkTheme.next(true);
        localStorage.setItem('theme', 'dark');
    }

    enableLightMode() {
        this.renderer.removeClass(document.body, 'dark-theme');
        this._isDarkTheme.next(false);
        localStorage.setItem('theme', 'light');
    }

    toggleTheme() {
        if (this._isDarkTheme.value) {
            this.enableLightMode();
        } else {
            this.enableDarkMode();
        }
    }
}
