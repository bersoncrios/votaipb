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
    faArrowLeft,
    faTrash,
    faEye,
    faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { DashboardService, ContactMessage } from '../../../../services/dash.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

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
    faTrash = faTrash;
    faEye = faEye;
    faEyeSlash = faEyeSlash;

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

    async toggleRead(msg: ContactMessage, event: Event) {
        event.stopPropagation();
        if (msg.id) {
            await this.dashboardService.markAsRead(msg.id, !msg.read);
        }
    }

    async deleteMessage(msg: ContactMessage, event?: Event) {
        event?.stopPropagation();

        const result = await Swal.fire({
            title: 'Excluir mensagem?',
            text: `Mensagem de "${msg.name}" será excluída permanentemente.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Excluir',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed && msg.id) {
            await this.dashboardService.deleteMessage(msg.id);
            if (this.selectedMessage?.id === msg.id) {
                this.selectedMessage = null;
            }
            Swal.fire('Excluída!', 'Mensagem excluída com sucesso.', 'success');
        }
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

