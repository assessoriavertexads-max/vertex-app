/**
 * Validação de CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  let remainder: number;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights1[i];
  }

  remainder = sum % 11;
  remainder = remainder < 2 ? 0 : 11 - remainder;
  if (remainder !== parseInt(cleanCNPJ[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights2[i];
  }

  remainder = sum % 11;
  remainder = remainder < 2 ? 0 : 11 - remainder;
  if (remainder !== parseInt(cleanCNPJ[13])) return false;

  return true;
}

/**
 * Validação de CPF
 */
export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder: number;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF[i - 1]) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF[i - 1]) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;

  return true;
}

/**
 * Validação de CNPJ ou CPF
 */
export function isValidCNPJorCPF(document: string): boolean {
  if (!document) return true; // Campo opcional
  
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 14) {
    return isValidCNPJ(document);
  } else if (cleaned.length === 11) {
    return isValidCPF(document);
  }
  
  return false;
}

/**
 * Formata CNPJ com máscara
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF com máscara
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ ou CPF com máscara automática
 */
export function formatCNPJorCPF(document: string): string {
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 14) {
    return formatCNPJ(document);
  } else if (cleaned.length === 11) {
    return formatCPF(document);
  }
  
  return document;
}
