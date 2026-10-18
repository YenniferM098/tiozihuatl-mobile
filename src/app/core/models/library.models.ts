/** Campos devueltos por GET /catalog; no existe endpoint de detalle individual. */
export interface LibraryBook {
  id: number;
  titulo: string;
  autores: string | null;
  editorial: string | null;
  materias: string | null;
  semestres?: string | null;
  tiene_digital: number;
  tiene_fisico: number;
  pdf_url: string | null;
}
export interface LibraryFilters {
  search: string;
  materia: string;
  semestre: string;
  formato: '' | 'DIGITAL' | 'FISICO';
  ordenAutor: '' | 'ASC' | 'DESC';
}
export interface LibrarySubject { id: number; nombre: string; }
export interface LibrarySemester { id_semestre: number; nombre_semestre: string; }
