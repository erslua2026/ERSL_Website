import { FormerStint, Person } from '../types';

export function getLocalTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inferAlumniRoleFromRoleText(role?: string): string {
  const r = (role || '').toLowerCase();
  if (r.includes('ph.d') || r.includes('phd') || r.includes('doctoral')) return 'Ph.D.';
  if (r.includes('master') || /\bm\.?s\.?\b/.test(r) || r.includes('msc')) return 'MS';
  if (r.includes('postdoc')) return 'Postdoctoral Researcher';
  if (r.includes('research scientist')) return 'Research Scientist';
  if (r.includes('undergrad')) return 'Undergraduate Researcher';
  if (r.includes('visiting')) return 'Visiting Scholar';
  return (role || '').trim() || 'Former Member';
}

export function graduatePersonToFormer(person: Person, fallbackDateYmd = getLocalTodayYmd()): Person {
  const gradDate = (person.expectedGraduationDate || '').trim() || fallbackDateYmd;
  const gradYear = gradDate.slice(0, 4) || String(new Date().getFullYear());
  const degreeOrRole = (person.graduationDegree || '').trim() || inferAlumniRoleFromRoleText(person.role);
  const topic = (person.thesisTopic || person.formerTopic || person.researchFocus || '').trim();

  const existingStints: FormerStint[] = Array.isArray(person.formerStints) ? person.formerStints : [];
  const nextStints: FormerStint[] =
    existingStints.length > 0
      ? existingStints
      : [
          {
            role: degreeOrRole,
            years: person.formerYears || gradYear,
            topic: topic || undefined,
          },
        ];

  const primary = nextStints[0];
  return {
    ...person,
    group: 'former',
    role: primary?.role || degreeOrRole,
    formerYears: primary?.years || gradYear,
    formerTopic: primary?.topic || topic || undefined,
    researchFocus:
      nextStints
        .map(s => s.topic)
        .filter(Boolean)
        .join('; ') ||
      person.researchFocus ||
      '',
    formerStints: nextStints,
    currentAffiliation: person.currentAffiliation?.trim() || undefined,
  };
}

/**
 * Checks active Team members for expectedGraduationDate <= today and automatically
 * graduates them to Former Members with their recorded role, year, topic, and affiliation.
 */
export function applyAutoGraduation(
  list: Person[],
  todayYmd = getLocalTodayYmd()
): { updatedList: Person[]; graduatedNames: string[] } {
  const graduatedNames: string[] = [];
  const updatedList = list.map(person => {
    const group = person.group || 'member';
    const gradDate = (person.expectedGraduationDate || '').trim();
    if (group === 'member' && gradDate && /^\d{4}-\d{2}-\d{2}$/.test(gradDate) && todayYmd >= gradDate) {
      graduatedNames.push(person.name);
      return graduatePersonToFormer(person, gradDate);
    }
    return person;
  });
  return { updatedList, graduatedNames };
}

