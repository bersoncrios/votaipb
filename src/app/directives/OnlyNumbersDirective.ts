import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appOnlyNumbers]', // Usaremos este seletor no HTML
  standalone: true // Diretiva autônoma para fácil importação
})
export class OnlyNumbersDirective {

  // Regex que permite apenas números
  private regex: RegExp = new RegExp(/^[0-9]*$/g);

  // Lista de teclas especiais permitidas (Backspace, Tab, Setas, Delete, etc.)
  private specialKeys: Array<string> = ['Backspace', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight', 'Delete', 'Del'];

  constructor(private el: ElementRef) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Permite teclas especiais
    if (this.specialKeys.indexOf(event.key) !== -1) {
      return;
    }

    // Permite Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Cmd+A (para Mac)
    if ((event.key === 'a' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'c' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'v' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'x' && (event.ctrlKey || event.metaKey))) {
      return;
    }

    // Obtém o valor atual e a tecla pressionada
    const current: string = this.el.nativeElement.value;
    // Previne a ação se a tecla não for numérica (e não for especial)
    // Usamos event.key que representa o caractere digitado
    if (event.key && !String(event.key).match(/^[0-9]$/)) {
        event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    // Previne a ação de colar padrão
    event.preventDefault();
    // Obtém o texto colado
    const pastedInput: string = event.clipboardData?.getData('text/plain') || '';
    // Remove qualquer caractere não numérico do texto colado
    const sanitizedInput = pastedInput.replace(/[^0-9]/g, '');
    // Insere o texto limpo no campo
    document.execCommand('insertText', false, sanitizedInput);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    // Previne a ação de arrastar padrão
    event.preventDefault();
    const textData = event.dataTransfer?.getData('text') || '';
     // Remove qualquer caractere não numérico do texto arrastado
    const sanitizedInput = textData.replace(/[^0-9]/g, '');
    // Insere o texto limpo no campo
     this.el.nativeElement.focus(); // Foca no campo antes de inserir
    document.execCommand('insertText', false, sanitizedInput);
  }
}
