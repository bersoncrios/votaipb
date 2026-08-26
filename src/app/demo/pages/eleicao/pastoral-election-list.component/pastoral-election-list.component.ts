import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EleicaoPastoralService } from '../../../../services/eleicao-pastoral.service';
import { EleicaoPastoral } from '../../../../models/EleicaoPastoral';
import { AuthService } from '../../../../services/auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

@Component({
    selector: 'app-pastoral-election-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatPaginatorModule
    ],
    templateUrl: './pastoral-election-list.component.html',
    styleUrls: ['./pastoral-election-list.component.scss']
})
export class PastoralElectionListComponent implements OnInit {
    private eleicaoService = inject(EleicaoPastoralService);
    private authService = inject(AuthService);

    public allEleicoes = signal<EleicaoPastoral[]>([]);
    public isLoading = signal<boolean>(true);
    public error = signal<string | null>(null);

    public pageIndex = signal<number>(0);
    public pageSize = signal<number>(6);

    public paginatedEleicoes = computed(() => {
        const startIndex = this.pageIndex() * this.pageSize();
        return this.allEleicoes().slice(startIndex, startIndex + this.pageSize());
    });

    ngOnInit(): void {
        const adminUid = this.authService.getCurrentUserUid();
        if (!adminUid) {
            this.error.set('Usuário não autenticado.');
            this.isLoading.set(false);
            return;
        }

        this.eleicaoService.getEleicoesPastoraisDoAdmin(adminUid).subscribe({
            next: (data) => {
                this.allEleicoes.set(data);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Erro ao carregar eleições pastorais:', err);
                this.error.set('Erro ao carregar a lista de eleições pastorais.');
                this.isLoading.set(false);
            }
        });
    }

    onPageChange(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.pageSize.set(event.pageSize);
    }
}
