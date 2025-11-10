import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ListaInscricaoService } from '../../../../services/lista-inscricao.service'; // Confirme o caminho
import { ListaInscricao, Inscrito } from '../../../../models/Inscricao'; // Confirme o caminho
import { Observable } from 'rxjs';
import { SharedModule } from 'src/app/shared/shared.module'; // Importe o seu SharedModule
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx'; // Importe a biblioteca do Excel

@Component({
  selector: 'app-admin-listas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SharedModule
  ],
  templateUrl: './admin-listas.component.html',
  styleUrls: ['./admin-listas.component.scss']
})
export class AdminListasComponent implements OnInit {
  private listaService = inject(ListaInscricaoService);
  private fb = inject(FormBuilder);

  public listas$!: Observable<ListaInscricao[]>;
  public showForm = false; // Controla a visibilidade do formulário de criação

  public form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(5)]],
    descricao: ['']
  });

  ngOnInit() {
    // Busca as listas assim que o componente é iniciado
    // Graças à correção anterior, isto espera o login antes de consultar
    this.listas$ = this.listaService.getListasDoAdmin();
  }

  /**
   * Submete o formulário para criar uma nova lista
   */
  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      await this.listaService.criarLista(
        this.form.value.titulo!,
        this.form.value.descricao || ''
      );

      Swal.fire('Sucesso', 'Nova lista de inscrição criada!', 'success');
      this.form.reset();
      this.showForm = false; // Fecha o formulário
    } catch (error) {
      Swal.fire('Erro', 'Não foi possível criar a lista.', 'error');
    }
  }

  /**
   * Ativa ou desativa uma lista para novas inscrições
   */
  async toggleStatus(lista: ListaInscricao) {
    const novoStatus = !lista.ativa;
    await this.listaService.alternarStatusLista(lista.id, novoStatus);
    const texto = novoStatus ? 'aberta' : 'fechada';
    Swal.fire('Atualizado', `A lista foi ${texto} para novas inscrições.`, 'success');
  }

  /**
   * Copia o link público de inscrição (ex: /inscricao/ID_DA_LISTA)
   */
  copiarLink(listaId: string) {
    const url = `${window.location.origin}/inscrever/${listaId}`;
    navigator.clipboard.writeText(url).then(() => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Link copiado!',
        showConfirmButton: false,
        timer: 3000
      });
    });
  }

  /**
   * [FUNCIONALIDADE PRINCIPAL] Gera e baixa o ficheiro Excel
   */
  exportarExcel(lista: ListaInscricao) {
    const inscritos = lista.inscritos || [];

    if (inscritos.length === 0) {
      Swal.fire('Atenção', 'Não há inscritos nesta lista para exportar.', 'info');
      return;
    }

    // 1. Mapeia os dados para o formato { id, nome } que o seu sistema de eleição espera
    const dadosParaExportar = inscritos.map(inscrito => ({
      id: inscrito.id,
      nome: inscrito.nome
    }));

    // 2. Cria a "folha de cálculo" (worksheet) a partir do array de objetos
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dadosParaExportar);

    // 3. Cria o "livro" (workbook)
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membros'); // O nome da aba será "Membros"

    // 4. Gera o ficheiro
    // Remove espaços e caracteres especiais do título para o nome do ficheiro
    const nomeFicheiro = `${lista.titulo.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
    XLSX.writeFile(wb, nomeFicheiro);
  }
}
