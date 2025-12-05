import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
    faEnvelope,
    faEnvelopeOpen,
    faUser,
    faPhone,
    faCalendar,
    faInbox,
    faCircle,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { DashboardService, ContactMessage } from '../../../../services/dash.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-admin-inbox',
    templateUrl: './admin-inbox.component.html',
    styleUrls: ['./admin-inbox.component.scss'],
    standalone: true,
    imports: [CommonModule, FontAwesomeModule]
})
export class AdminInboxComponent implements OnInit, OnDestroy {
    // Icons
    faEnvelope = faEnvelope;
    faEnvelopeOpen = faEnvelopeOpen;
    faUser = faUser;
    faPhone = faPhone;
    faCalendar = faCalendar;
    faInbox = faInbox;
    faCircle = faCircle;
    faArrowLeft = faArrowLeft;

    private dashboardService = inject(DashboardService);
    private subscription?: Subscription;

    messages: ContactMessage[] = [];
    selectedMessage: ContactMessage | null = null;
    isLoading = true;

    ngOnInit() {
        this.subscription = this.dashboardService.getMessages().subscribe({
            next: (msgs) => {
                this.messages = msgs;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Erro ao carregar mensagens:', err);
                this.isLoading = false;
            }
        });
    }

    ngOnDestroy() {
        this.subscription?.unsubscribe();
    }

    selectMessage(msg: ContactMessage) {
        this.selectedMessage = msg;
        if (msg.id && !msg.read) {
            this.dashboardService.markAsRead(msg.id);
        }
    }

    closeDetail() {
        this.selectedMessage = null;
    }

    getUnreadCount(): number {
        return this.messages.filter(m => !m.read).length;
    }

    formatDate(timestamp: any): string {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getInitials(name: string): string {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
}
