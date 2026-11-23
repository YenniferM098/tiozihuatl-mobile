const ORDINALS: Record<string, number> = {
  primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10,
};

/**
 * Semestres en etiquetas cortas para las tarjetas (#229):
 * "Primer semestre,Segundo semestre" → ["1.º", "2.º"]. Lo que no se reconoce se deja tal cual.
 */
export function shortSemesters(value: string | null | undefined): string[] {
  if (!value) return [];
  const labels = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const word = part.split(/\s+/)[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      const number = ORDINALS[word] ?? (/^\d+$/.test(word) ? Number(word) : undefined);
      return number ? `${number}.º` : part;
    });
  // Primero los semestres numéricos en orden (1.º, 2.º…), después lo que no se reconoce.
  const order = (label: string) => (/^\d+\.º$/.test(label) ? parseInt(label, 10) : Number.MAX_SAFE_INTEGER);
  return [...new Set(labels)].sort((a, b) => order(a) - order(b));
}

/** Lista separada por comas con un espacio después de cada coma: "A,B" → "A, B". */
export function commaList(value: string | null | undefined): string {
  return (value ?? '').split(',').map((part) => part.trim()).filter(Boolean).join(', ');
}
