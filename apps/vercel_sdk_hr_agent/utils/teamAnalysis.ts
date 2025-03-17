import { Employee } from './types';
import { ObjectId } from 'mongodb';

// Calculate how well the team covers the required skills
export function calculateSkillCoverage(
  team: Employee[],
  requiredSkills: { skill: string; importance: number }[]
): number {
  let totalImportance = 0;
  let coveredImportance = 0;

  // Sum up total importance
  requiredSkills.forEach(req => {
    totalImportance += req.importance;
  });

  // For each required skill
  requiredSkills.forEach(req => {
    // Find the best match in the team
    let bestMatch = 0;

    team.forEach(employee => {
      employee.skills.forEach(skill => {
        // Simple text matching - in a real implementation,
        // we would use vector similarity here
        if (skill.name.toLowerCase().includes(req.skill.toLowerCase()) ||
            req.skill.toLowerCase().includes(skill.name.toLowerCase())) {
          // Consider proficiency level
          const match = (skill.proficiency / 5) * req.importance;
          bestMatch = Math.max(bestMatch, match);
        }
      });
    });

    coveredImportance += bestMatch;
  });

  if (totalImportance === 0) return 0;

  // Return percentage of coverage
  return (coveredImportance / totalImportance) * 100;
}

// Calculate team diversity based on departments, skills, and experience levels
export function calculateTeamDiversity(team: Employee[]): number {
  if (team.length <= 1) return 0;

  // Count unique departments
  const departments = new Set(team.map(e => e.department));

  // Calculate skill diversity
  const allSkills = team.flatMap(e => e.skills.map(s => s.name));
  const uniqueSkills = new Set(allSkills);

  // Calculate experience spread (standard deviation of years of experience)
  const hireYears = team.map(e => new Date(e.hireDate).getFullYear());
  const avgYear = hireYears.reduce((sum, y) => sum + y, 0) / hireYears.length;
  const yearVariance = hireYears.reduce((sum, y) => sum + Math.pow(y - avgYear, 2), 0) / hireYears.length;
  const yearStdDev = Math.sqrt(yearVariance);

  // Normalize and combine factors
  // More departments, more unique skills, and moderate experience spread (not too high or low) are good
  const deptScore = (departments.size / team.length) * 100;
  const skillScore = (uniqueSkills.size / allSkills.length) * 100;
  const expScore = Math.min(yearStdDev * 10, 100); // Cap at 100

  return (deptScore * 0.3) + (skillScore * 0.5) + (expScore * 0.2);
}

// Analyze past collaboration success
export function analyzeCollaborationHistory(team: Employee[]): {
  previousCollaborations: number;
  averageSuccessScore: number;
} {
  let collaborationCount = 0;
  let totalSuccessScore = 0;

  // Check each pair of team members
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      // Check if they worked together before
      const employee1 = team[i];
      const employee2 = team[j];

      if (!employee1.teamHistory || !employee2.teamHistory) continue;

      const collaborations = employee1.teamHistory.filter(memberId =>
        employee2._id && memberId.toString() === employee2._id.toString()
      );

      if (collaborations.length > 0) {
        collaborationCount++;

        // Calculate average success score from shared projects
        const sharedProjects = employee1.pastProjects.filter(p1 =>
          employee2.pastProjects.some(p2 => p1.projectId.toString() === p2.projectId.toString())
        );

        if (sharedProjects.length > 0) {
          totalSuccessScore += 4; // Placeholder in this example
        } else {
          totalSuccessScore += 3;
        }
      }
    }
  }

  // Avoid division by zero
  if (collaborationCount === 0) {
    return { previousCollaborations: 0, averageSuccessScore: 0 };
  }

  return {
    previousCollaborations: collaborationCount,
    averageSuccessScore: totalSuccessScore / collaborationCount
  };
}

// Calculate overall team score
export function calculateTeamScore(
  skillCoverage: number,
  diversity: number,
  collaboration: { previousCollaborations: number; averageSuccessScore: number }
): number {
  // Weight factors based on their importance
  const skillWeight = 0.5; // Skill coverage is most important
  const diversityWeight = 0.3; // Diversity is important
  const collaborationWeight = 0.2; // Past collaboration success is also important

  // Calculate collaboration score - normalize number of collaborations
  let collaborationScore = 0;
  if (collaboration.previousCollaborations > 0) {
    const collaborationAmount = Math.min(collaboration.previousCollaborations / 3, 1) * 100;
    const successScore = (collaboration.averageSuccessScore / 5) * 100;
    collaborationScore = (collaborationAmount * 0.4) + (successScore * 0.6);
  }

  // Combine all factors
  return (skillCoverage * skillWeight) +
         (diversity * diversityWeight) +
         (collaborationScore * collaborationWeight);
}

// Generate textual analysis of the team
export function generateTeamAnalysis(
  team: Employee[],
  skillCoverage: number,
  overallScore: number
): string {
  // Start with overall assessment
  let analysis = `This team of ${team.length} members has `;

  if (skillCoverage > 90) analysis += "excellent";
  else if (skillCoverage > 80) analysis += "strong";
  else if (skillCoverage > 70) analysis += "good";
  else if (skillCoverage > 60) analysis += "moderate";
  else analysis += "limited";

  analysis += " skill coverage. ";

  // Add details about key members
  const keyMembers = team.filter(e => e.performance && e.performance.rating >= 4);
  if (keyMembers.length > 0) {
    analysis += `The team includes ${keyMembers.length} high-performing members with strong track records. `;
  }

  // Comment on collaboration history
  const departments = new Set(team.map(e => e.department));
  if (departments.size > 1) {
    analysis += `The team spans ${departments.size} different departments, which brings diverse perspectives but may require additional coordination. `;
  }

  // Identify potential gaps or risks
  const juniorCount = team.filter(e => new Date().getFullYear() - new Date(e.hireDate).getFullYear() < 2).length;
  if (juniorCount > team.length / 2) {
    analysis += "The team has a relatively high proportion of junior members, which may impact delivery speed. ";
  }

  // Overall recommendation
  if (overallScore > 85) {
    analysis += "This team composition is highly recommended.";
  } else if (overallScore > 75) {
    analysis += "This team composition is recommended.";
  } else if (overallScore > 65) {
    analysis += "This team composition is acceptable but could be improved.";
  } else {
    analysis += "Consider exploring alternative team compositions to improve the overall balance.";
  }

  return analysis;
}
