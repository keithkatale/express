export type StudentSearchResult = {
  id: string;
  full_name: string;
  class_name: string;
  admission_no: string;
  slug: string;
  student_code: string;
  has_parent_linked: boolean;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarityScore(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return 0;
  if (n.includes(q) || q.includes(n)) return 1;
  if (n.split(/\s+/).some((part) => part.startsWith(q) || q.startsWith(part))) return 0.85;

  const distance = levenshtein(q, n);
  const maxLen = Math.max(q.length, n.length);
  return Math.max(0, 1 - distance / maxLen);
}

export function rankStudentMatches(
  query: string,
  students: StudentSearchResult[],
  minScore = 0.35
): StudentSearchResult[] {
  if (!query.trim()) return students.slice(0, 8);

  return students
    .map((student) => ({
      student,
      score: Math.max(
        similarityScore(query, student.full_name),
        similarityScore(query, student.admission_no) * 0.9,
        similarityScore(query, student.student_code) * 0.95,
        similarityScore(query, student.slug) * 0.85,
        similarityScore(query, student.class_name) * 0.5
      ),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ student }) => student)
    .slice(0, 8);
}
