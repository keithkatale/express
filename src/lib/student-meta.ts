export function formatStudentMeta({
  className,
  studentCode,
  slug,
  admissionNo,
}: {
  className: string;
  studentCode?: string | null;
  slug?: string | null;
  admissionNo?: string | null;
}): string {
  const parts = [className];

  if (studentCode) {
    parts.push(`ID ${studentCode}`);
  } else if (admissionNo) {
    parts.push(admissionNo);
  }

  if (slug) {
    parts.push(slug);
  }

  return parts.join(" · ");
}
