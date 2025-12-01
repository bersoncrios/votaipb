import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EleicaoOficialService } from '../../../../services/eleicao-oficial.service';
import { EleicaoOficial } from '../../../../models/EleicaoOficial';
import { CargoOficial } from '../../../../models/CargoOficial';
import { Candidato } from '../../../../models/Candidato';
import Swal from 'sweetalert2';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SharedModule } from 'src/app/shared/shared.module';

type VotacaoStep = 'carregando' | 'identificacao' | 'votacao' | 'confirmacao' | 'concluido' | 'erro';


@Component({
    selector: 'app-votar-oficial',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatProgressSpinnerModule,
        SharedModule
    ],
    templateUrl: './votar-oficial.component.html',
    styleUrls: ['./votar-oficial.component.scss']
})
export class VotarOficialComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private fb = inject(FormBuilder);
    private eleicaoService = inject(EleicaoOficialService);

    step: VotacaoStep = 'carregando';
    eleicaoId: string | null = null;
    eleicao: EleicaoOficial | null = null;
    cargoAberto: CargoOficial | null = null;
    eleitorValidado: { id: string; nome: string } | null = null;
    errorMessage = '';

    idForm: FormGroup;
    votosForm: FormGroup;

    constructor() {
        this.idForm = this.fb.group({
            eleitorId: ['', Validators.required]
        });

        this.votosForm = this.fb.group({
            candidatos: this.fb.array([])
        });
    }

    get candidatos(): FormArray {
        return this.votosForm.get('candidatos') as FormArray;
    }

    ngOnInit() {
        this.eleicaoId = this.route.snapshot.paramMap.get('id');
        if (!this.eleicaoId) {
            this.errorMessage = 'ID da eleição não fornecido.';
            this.step = 'erro';
            return;
        }

        this.carregarDadosEleicao(this.eleicaoId);
    }

    setupCandidatosCheckboxes(candidatos: Candidato[]) {
        candidatos.forEach(() => {
            this.candidatos.push(new FormControl(false));
        });
    }

    onValidarEleitor() {
        if (this.idForm.invalid) {
            this.idForm.markAllAsTouched();
            return;
        }

        const eleitorId = this.idForm.value.eleitorId.trim();

        // Valida se é um membro elegível
        const membro = this.eleicao?.membrosElegiveis.find(m => m.id === eleitorId);
        if (!membro) {
            Swal.fire('Erro', 'ID não encontrado na lista de votantes.', 'error');
            return;
        }

        // Valida se já votou
        const jaVotou = this.cargoAberto?.votos.some((v: any) => v.eleitorId === eleitorId);
        if (jaVotou) {
            Swal.fire('Atenção', 'Você já votou neste cargo.', 'warning');
            return;
        }

        this.eleitorValidado = { id: eleitorId, nome: membro.nome };
        this.step = 'votacao';
    }

    get candidatosSelecionados(): Candidato[] {
        if (!this.cargoAberto) return [];

        return this.cargoAberto.candidatos.filter((_: Candidato, i: number) => this.candidatos.at(i).value);
    }

    get podeAvancar(): boolean {
        const selecionados = this.candidatosSelecionados.length;
        const vagas = this.cargoAberto?.vagas || 0;
        return selecionados > 0 && selecionados <= vagas;
    }

    onAvancarParaConfirmacao() {
        if (!this.podeAvancar) {
            const vagas = this.cargoAberto?.vagas || 0;
            Swal.fire('Atenção', `Você deve selecionar entre 1 e ${vagas} candidato(s).`, 'warning');
            return;
        }

        this.step = 'confirmacao';
    }

    async onConfirmarVoto() {
        if (!this.eleicao || !this.eleitorValidado) return;

        this.step = 'carregando';

        try {
            const candidatosIds = this.candidatosSelecionados.map(c => c.userId);

            await this.eleicaoService.registrarVoto(
                this.eleicao.id,
                this.eleitorValidado.id,
                candidatosIds
            );

            this.step = 'concluido';
            Swal.fire('Sucesso!', 'Seu voto foi registrado com sucesso.', 'success');
        } catch (e: any) {
            console.error('Erro ao registrar voto:', e);
            this.errorMessage = e.message || 'Erro ao registrar o voto.';
            this.step = 'erro';
            Swal.fire('Erro', this.errorMessage, 'error');
        }
    }

    corrigirVoto() {
        this.step = 'votacao';
    }

    isCandidatoSelecionado(index: number): boolean {
        return this.candidatos.at(index).value;
    }

    toggleCandidato(index: number) {
        const control = this.candidatos.at(index);
        control.setValue(!control.value);
    }

    reiniciar() {
        this.step = 'identificacao';
        this.idForm.reset();
        this.votosForm.reset();
        this.eleitorValidado = null;
        this.candidatos.controls.forEach(c => c.setValue(false));
        this.errorMessage = '';

        // Recarregar dados se necessário (opcional, mas bom para garantir estado fresco)
        if (this.eleicaoId) {
            this.carregarDadosEleicao(this.eleicaoId);
        }
    }

    carregarDadosEleicao(id: string) {
        this.step = 'carregando';
        this.eleicaoService.getEleicaoOficial(id).subscribe({
            next: (eleicao) => {
                this.eleicao = eleicao;

                if (!eleicao.cargoAbertoId) {
                    this.errorMessage = 'Nenhum cargo está aberto para votação no momento.';
                    this.step = 'erro';
                    return;
                }

                this.cargoAberto = eleicao.cargos.find(c => c.id === eleicao.cargoAbertoId) || null;

                if (!this.cargoAberto) {
                    this.errorMessage = 'Cargo aberto não encontrado.';
                    this.step = 'erro';
                    return;
                }

                // Reinicializa checkboxes se o tamanho mudou (ou na primeira vez)
                if (this.candidatos.length !== this.cargoAberto.candidatos.length) {
                    this.candidatos.clear();
                    this.setupCandidatosCheckboxes(this.cargoAberto.candidatos);
                }

                this.step = 'identificacao';
            },
            error: (err) => {
                console.error('Erro ao carregar eleição:', err);
                this.errorMessage = 'Erro ao carregar os dados da eleição.';
                this.step = 'erro';
            }
        });
    }
}
