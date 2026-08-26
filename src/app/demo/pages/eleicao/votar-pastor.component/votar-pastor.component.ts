import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EleicaoPastoralService } from '../../../../services/eleicao-pastoral.service';
import { EleicaoPastoral } from '../../../../models/EleicaoPastoral';
import { CargoPastoral } from '../../../../models/CargoPastoral';
import { Candidato } from '../../../../models/Candidato';
import { Membro } from '../../../../models/Membro';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-votar-pastor',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatRadioModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './votar-pastor.component.html',
    styleUrls: ['./votar-pastor.component.scss']
})

export class VotarPastorComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private eleicaoService = inject(EleicaoPastoralService);
    private snackBar = inject(MatSnackBar);

    eleicaoId: string | null = null;
    eleicao$: Observable<EleicaoPastoral | null> = of(null);

    // Form states
    eleitorId: string = '';
    membroValidado: Membro | null = null;
    erroValidacao: string | null = null;
    passo: 'identificacao' | 'votacao' | 'confirmacao' | 'sucesso' = 'identificacao';

    candidatosSelecionados: Set<string> = new Set();
    votoEspecial: 'BRANCO' | 'NULO' | 'NENHUM' = 'NENHUM';
    isEnviando = false;

    ngOnInit() {
        this.eleicao$ = this.route.paramMap.pipe(
            switchMap(params => {
                this.eleicaoId = params.get('id');
                if (this.eleicaoId) {
                    return this.eleicaoService.getEleicaoPastoral(this.eleicaoId);
                }
                return of(null);
            }),
            catchError(err => {
                console.error('Erro ao carregar eleição pastoral:', err);
                return of(null);
            })
        );
    }

    getCargoAberto(eleicao: EleicaoPastoral): CargoPastoral | null {
        if (!eleicao || !eleicao.cargoAbertoId) return null;
        return eleicao.cargos.find(c => c.id === eleicao.cargoAbertoId) || null;
    }

    getInitials(name: string): string {
        if (!name) return 'P';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    validarIdentificacao(eleicao: EleicaoPastoral) {
        this.erroValidacao = null;
        const idProcurado = this.eleitorId.trim().toLowerCase();

        if (!idProcurado) {
            this.erroValidacao = 'Por favor, informe seu ID ou Matrícula.';
            return;
        }

        // REGRA DE NEGÓCIO PASTORAL 1: O Pastor Candidato NÃO VOTA
        const ehPastorCandidato = eleicao.cargos.some(cargo =>
            cargo.candidatos.some(c => c.userId.trim().toLowerCase() === idProcurado)
        );

        if (ehPastorCandidato) {
            this.erroValidacao = 'O pastor candidato não possui direito a voto nesta eleição.';
            return;
        }

        // REGRA 2: Verifica se está na lista de votantes elegíveis
        const membro = eleicao.membrosElegiveis.find(m => m.id.trim().toLowerCase() === idProcurado);

        if (!membro) {
            this.erroValidacao = 'ID não encontrado na lista de votantes elegíveis desta igreja.';
            return;
        }

        // REGRA 3: Verifica se já votou no cargo aberto
        const cargoAberto = this.getCargoAberto(eleicao);
        if (!cargoAberto) {
            this.erroValidacao = 'Nenhuma votação pastoral está aberta no momento.';
            return;
        }

        const jaVotou = cargoAberto.votos.some(v => v.eleitorId.trim().toLowerCase() === idProcurado);
        if (jaVotou) {
            this.erroValidacao = 'Seu voto já foi computado para esta votação pastoral.';
            return;
        }

        this.membroValidado = membro;
        this.passo = 'votacao';
    }

    toggleCandidato(candidatoId: string, cargo: CargoPastoral) {
        this.votoEspecial = 'NENHUM';

        if (cargo.vagas === 1) {
            // Se for 1 vaga (Eleição Pastoral de Voto Único), a seleção é exclusiva (Radio)
            if (this.candidatosSelecionados.has(candidatoId)) {
                this.candidatosSelecionados.clear();
            } else {
                this.candidatosSelecionados.clear();
                this.candidatosSelecionados.add(candidatoId);
            }
        } else {
            // Múltiplas vagas
            if (this.candidatosSelecionados.has(candidatoId)) {
                this.candidatosSelecionados.delete(candidatoId);
            } else {
                if (this.candidatosSelecionados.size >= cargo.vagas) {
                    this.snackBar.open(`Você só pode selecionar até ${cargo.vagas} candidato(s) para este cargo.`, 'OK', { duration: 3000 });
                    return;
                }
                this.candidatosSelecionados.add(candidatoId);
            }
        }
    }


    selecionarVotoBranco() {
        this.candidatosSelecionados.clear();
        this.votoEspecial = 'BRANCO';
    }

    selecionarVotoNulo() {
        this.candidatosSelecionados.clear();
        this.votoEspecial = 'NULO';
    }

    podeAvancar(cargo: CargoPastoral): boolean {
        if (this.votoEspecial !== 'NENHUM') return true;
        return this.candidatosSelecionados.size > 0 && this.candidatosSelecionados.size <= cargo.vagas;
    }

    irParaConfirmacao() {
        this.passo = 'confirmacao';
    }

    voltarParaVotacao() {
        this.passo = 'votacao';
    }

    getCandidatosSelecionadosNomes(cargo: CargoPastoral): string[] {
        if (this.votoEspecial === 'BRANCO') return ['⚪ Voto em Branco'];
        if (this.votoEspecial === 'NULO') return ['🔴 Voto Nulo'];

        return cargo.candidatos
            .filter(c => this.candidatosSelecionados.has(c.userId))
            .map(c => c.nome);
    }

    async confirmarEVotar(eleicao: EleicaoPastoral, cargo: CargoPastoral) {
        if (!this.membroValidado) return;

        this.isEnviando = true;
        let votosFinal: string[] = [];

        if (this.votoEspecial === 'BRANCO') {
            votosFinal = ['BRANCO'];
        } else if (this.votoEspecial === 'NULO') {
            votosFinal = ['NULO'];
        } else {
            votosFinal = Array.from(this.candidatosSelecionados);
        }

        try {
            await this.eleicaoService.registrarVoto(
                eleicao.id,
                cargo.id,
                this.membroValidado.id,
                votosFinal
            );

            this.passo = 'sucesso';
        } catch (e: any) {
            console.error('Erro ao registrar voto:', e);
            Swal.fire('Erro no Voto', e.message || 'Falha ao registrar voto.', 'error');
            this.passo = 'votacao';
        } finally {
            this.isEnviando = false;
        }
    }
}
