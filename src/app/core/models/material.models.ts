export interface ComplementaryMaterial {
  id_material: number; titulo: string; descripcion: string | null; tipo: string;
  id_usuario: number; nombre_docente: string | null; materias: string | null;
  semestres: string | null; fecha_creacion: string | null; activo: number; visibilidad: string;
  url?: string | null;
}
export interface MaterialsResponse { data: ComplementaryMaterial[]; total: number; page: number; limit: number; totalPages: number; }
/** El semestre es el de la cuenta, como en la web; no se permite modificarlo desde los filtros. */
export interface MaterialsFilters { search: string; materia: string; docente: string; tipo: string; }
export interface MaterialSubject { id: number; nombre: string; }
export interface MaterialTeacher { id_usuario: number; nombre: string; total_materiales: number; }
export interface MaterialSemester { id_semestre: number; nombre_semestre: string; }
export const MATERIAL_TYPES = ['PDF', 'VIDEO', 'IMAGEN', 'WORD', 'EXCEL', 'PPT'] as const;
export function materialIcon(type: string): string {
  return ({ PDF: 'file-pdf', VIDEO: 'video', IMAGEN: 'image', WORD: 'file-doc', EXCEL: 'file-xls', PPT: 'file-ppt' } as Record<string, string>)[type] ?? 'file';
}
