import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { EleicaoOficialService } from '../../../../services/eleicao-oficial.service';
import { EleicaoOficial } from '../../../../models/EleicaoOficial';
import { CargoOficial } from '../../../../models/CargoOficial';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-manage-officer-election',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './manage-officer-election.component.html',
    styleUrls: ['./manage-officer-election.component.scss']
})
export class ManageOfficerElectionComponent implements OnInit {


    private route = inject(ActivatedRoute);
    private eleicaoService = inject(EleicaoOficialService);

    eleicaoId: string | null = null;
    eleicao$: Observable<EleicaoOficial | null> = of(null);

    // Controle de sanfona de resultados
    private resultadosExpandidosSet = new Set<string>();

    ngOnInit() {
        this.eleicao$ = this.route.paramMap.pipe(
            switchMap(params => {
                this.eleicaoId = params.get('id');
                if (this.eleicaoId) {
                    return this.eleicaoService.getEleicaoOficial(this.eleicaoId);
                }
                return of(null);
            }),
            catchError(err => {
                console.error('Erro ao carregar eleição:', err);
                return of(null);
            })
        );
    }

    formatStatus(status: string | undefined): string {
        if (!status) return '';
        const mapStatus: Record<string, string> = {
            'em_andamento': 'Em Andamento',
            'em_votacao': 'Em Votação',
            'EM_VOTACAO': 'Em Votação',
            'agendada': 'Agendada',
            'finalizada': 'Finalizada',
            'finalizado': 'Finalizada',
            'aguardando': 'Aguardando Início'
        };
        return mapStatus[status] || mapStatus[status.toLowerCase()] || status;
    }

    getCargoTitulo(eleicao: EleicaoOficial, cargoId: string): string {
        const cargo = eleicao.cargos?.find(c => c.id === cargoId);
        return cargo ? cargo.titulo : 'Cargo em Votação';
    }


    async onAbrirVotacao(eleicao: EleicaoOficial, cargo: CargoOficial) {
        if (eleicao.cargoAbertoId) {
            Swal.fire('Atenção', 'Já existe uma votação aberta. Feche-a antes de abrir outra.', 'warning');
            return;
        }

        try {
            await this.eleicaoService.abrirVotacao(eleicao.id, cargo.id);
            Swal.fire('Sucesso', `Votação para ${cargo.titulo} iniciada!`, 'success');
        } catch (e: any) {
            Swal.fire('Erro', `Erro ao abrir votação: ${e.message}`, 'error');
        }
    }

    async onEncerrarVotacao(eleicao: EleicaoOficial, cargo: CargoOficial) {
        const { value: confirmou } = await Swal.fire({
            title: 'Confirmar Encerramento',
            text: 'Deseja encerrar a votação e apurar os votos?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, encerrar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmou) return;

        try {
            await this.eleicaoService.fecharVotacao(eleicao.id, cargo.id);
            Swal.fire('Sucesso', `Votação para ${cargo.titulo} encerrada e apurada!`, 'success');
        } catch (e: any) {
            Swal.fire('Erro', `Erro ao encerrar votação: ${e.message}`, 'error');
        }
    }

    async onCopiarLink(eleicaoId: string) {
        const origin = window.location.origin;
        const link = `${origin}/votar-oficial/${eleicaoId}`;
        try {
            await navigator.clipboard.writeText(link);
            Swal.fire('Link Copiado!', link, 'success');
        } catch (err) {
            Swal.fire('Erro', 'Não foi possível copiar o link.', 'error');
        }
    }

    getVotosBrancos(cargo: CargoOficial): number {
        if (!cargo || !cargo.votos) return 0;
        return cargo.votos.filter(v => v.candidatosIds && v.candidatosIds.includes('BRANCO')).length;
    }

    getVotosNulos(cargo: CargoOficial): number {
        if (!cargo || !cargo.votos) return 0;
        return cargo.votos.filter(v => v.candidatosIds && v.candidatosIds.includes('NULO')).length;
    }

    getResultadosOrdenados(cargo: CargoOficial): { nome: string; votos: number }[] {

        // Conta votos para cada candidato
        const contagemVotos = new Map<string, number>();

        cargo.candidatos.forEach(c => contagemVotos.set(c.userId, 0));

        cargo.votos.forEach(voto => {
            voto.candidatosIds.forEach(candidatoId => {
                if (contagemVotos.has(candidatoId)) {
                    contagemVotos.set(candidatoId, (contagemVotos.get(candidatoId) || 0) + 1);
                }
            });
        });

        // Cria array com nome e votos
        const resultados = cargo.candidatos.map(candidato => ({
            nome: candidato.nome,
            votos: contagemVotos.get(candidato.userId) || 0
        }));

        // Ordena por votos (decrescente)
        return resultados.sort((a, b) => b.votos - a.votos);
    }

    toggleResultados(cargoId: string): void {
        if (this.resultadosExpandidosSet.has(cargoId)) {
            this.resultadosExpandidosSet.delete(cargoId);
        } else {
            this.resultadosExpandidosSet.add(cargoId);
        }
    }

    isResultadosExpandidos(cargoId: string): boolean {
        return this.resultadosExpandidosSet.has(cargoId);
    }
}
