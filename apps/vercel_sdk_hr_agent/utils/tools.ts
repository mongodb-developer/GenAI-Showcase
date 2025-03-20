import { tool } from 'ai';
import { z } from 'zod';
import { MongoClient, ObjectId } from 'mongodb';
import { voyage } from 'voyage-ai-provider';
import { embedMany } from 'ai';
import {
  calculateSkillCoverage,
  calculateTeamDiversity,
  analyzeCollaborationHistory,
  calculateTeamScore,
  generateTeamAnalysis
} from './teamAnalysis';
import { Employee, Team } from './types';
import { generateEmbeddings } from './embeddings';

// Initialize MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URI!);
const db = mongoClient.db('hr_database');
const employeesCollection = db.collection<Employee>('employees');
const teamsCollection = db.collection<Team>('teams');

// Tool 1: Project Requirements Analysis
export const analyzeProjectRequirements = tool({
  description: 'Analyzes a project description to extract required skills, team size, and timeline.',
  parameters: z.object({
    projectDescription: z.string().describe('The detailed description of the project')
  }),
  execute: async ({ projectDescription }) => {
    // Extract skills and importance levels from the project description
    // In a real implementation, we'd use more sophisticated NLP
    // This is a simplified approach for demonstration

    // Extract skills
    const requiredSkills = [];
    const skillKeywords = [
      "React", "Angular", "Vue", "JavaScript", "TypeScript", "Node.js",
      "MongoDB", "SQL", "PostgreSQL", "AWS", "Azure", "Docker", "Kubernetes",
      // ... more skills would be included in a real implementation
    ];

    for (const skill of skillKeywords) {
      if (projectDescription.toLowerCase().includes(skill.toLowerCase())) {
        // Assign importance based on position and frequency
        const firstIndex = projectDescription.toLowerCase().indexOf(skill.toLowerCase());
        const count = (projectDescription.toLowerCase().match(new RegExp(skill.toLowerCase(), 'g')) || []).length;

        const positionFactor = Math.max(0, 1 - (firstIndex / projectDescription.length));
        const frequencyFactor = Math.min(1, count / 3);
        const importance = Math.round((positionFactor * 2.5 + frequencyFactor * 2.5));

        requiredSkills.push({
          skill,
          importance: Math.max(1, Math.min(5, importance))
        });
      }
    }

    // Sort by importance
    requiredSkills.sort((a, b) => b.importance - a.importance);

    // Extract estimated team size and timeline based on keywords
    let estimatedTeamSize = 3; // Default
    let timeline = "3 months"; // Default
    const specialRequirements = [];

    // Simple keyword extraction for other requirements
    if (projectDescription.includes("high visibility")) {
      specialRequirements.push("High visibility to executive team");
    }

    return {
      requiredSkills: requiredSkills.slice(0, 8), // Limit to top 8 skills
      estimatedTeamSize,
      timeline,
      specialRequirements
    };
  },
});

// Tool 2: Skill Search with MongoDB Vector Search
export const searchEmployeesBySkill = tool({
  description: 'Searches for employees with specific skills using semantic matching.',
  parameters: z.object({
    skillDescription: z.string().describe('Description of the required skill'),
    minProficiency: z.number().describe('Minimum proficiency level (1-5)'),
    minAvailability: z.number().describe('Minimum availability percentage')
  }),
  execute: async ({ skillDescription, minProficiency = 3, minAvailability = 20 }) => {
    try {
      // Generate embedding for the skill description using Voyage AI
      const embeddingResults = await generateEmbeddings(skillDescription);

      if (embeddingResults.length === 0) {
        return { error: "Failed to generate embedding for skill description" };
      }

      const embedding = embeddingResults[0].embedding;

      // Perform vector search with additional filters
      const matchingEmployees = await employeesCollection.aggregate([
        {
          $vectorSearch: {
            index: "skills_vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 100,
            limit: 20
          }
        },
        // Filter by proficiency and availability
        {
          $match: {
            "skills.proficiency": { $gte: minProficiency },
            "availability": { $gte: minAvailability }
          }
        },
        // Project relevant fields
        {
          $project: {
            _id: 1,
            name: 1,
            title: 1,
            department: 1,
            availability: 1,
            hireDate: 1,
            performance: 1,
            relevantSkills: {
              $filter: {
                input: "$skills",
                as: "skill",
                cond: { $gte: ["$$skill.proficiency", minProficiency] }
              }
            },
            pastProjects: 1,
            teamHistory: 1,
            similarity: { $meta: "vectorSearchScore" }
          }
        }
      ]).toArray();

      return matchingEmployees;
    } catch (error) {
      console.error("Error searching for employees:", error);
      return { error: "Failed to search for employees" };
    }
  },
});

// Tool 3: Team Composition Analysis
export const analyzeTeamComposition = tool({
  description: 'Analyzes a potential team composition for skill coverage, diversity, and past collaboration success.',
  parameters: z.object({
    teamMembers: z.array(z.string()).describe('Array of employee IDs to analyze as a team'),
    requiredSkills: z.array(
      z.object({
        skill: z.string(),
        importance: z.number().describe('Importance level of the skill (1-5)')
      })
    ).describe('Array of required skills with importance levels')
  }),
  execute: async ({ teamMembers, requiredSkills }) => {
    try {
      // Fetch complete employee records
      const employeeRecords = await employeesCollection.find({
        _id: { $in: teamMembers.map(id => new ObjectId(id)) }
      }).toArray();

      // Calculate skill coverage
      const skillCoverage = calculateSkillCoverage(employeeRecords, requiredSkills);

      // Analyze team diversity
      const diversityScore = calculateTeamDiversity(employeeRecords);

      // Check past collaboration
      const collaborationHistory = analyzeCollaborationHistory(employeeRecords);

      // Calculate overall team score
      const overallScore = calculateTeamScore(skillCoverage, diversityScore, collaborationHistory);

      // Generate team analysis
      const analysis = generateTeamAnalysis(employeeRecords, skillCoverage, overallScore);

      return {
        skillCoverage: Math.round(skillCoverage),
        diversityScore: Math.round(diversityScore),
        collaborationHistory,
        overallScore: Math.round(overallScore),
        analysis
      };
    } catch (error) {
      console.error("Error analyzing team composition:", error);
      return { error: "Failed to analyze team composition" };
    }
  },
});

// Tool 4: Database Integration - Save Team
export const saveTeamToDatabase = tool({
  description: 'Saves the recommended team to the database for future reference.',
  parameters: z.object({
    projectTitle: z.string(),
    projectDescription: z.string(),
    teamMembers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        keySkills: z.array(z.string()),
        justification: z.string()
      })
    ),
    skillCoverage: z.number(),
    overallRationale: z.string(),
    risks: z.array(z.string()),
    mitigationStrategies: z.array(z.string())
  }),
  execute: async ({
    projectTitle,
    projectDescription,
    teamMembers,
    skillCoverage,
    overallRationale,
    risks = [],
    mitigationStrategies = []
  }) => {
    try {
      // Format the team data according to our schema
      const teamData: Team = {
        projectTitle,
        projectDescription,
        createdAt: new Date(),
        members: teamMembers.map(member => ({
          name: member.name,
          role: member.role,
          keySkills: member.keySkills,
          justification: member.justification
        })),
        skillCoverage,
        overallRationale,
        risks,
        mitigationStrategies,
        status: 'proposed'
      };

      // Insert into the database
      const result = await teamsCollection.insertOne(teamData);

      if (result.acknowledged) {
        // Update employee availability (mark them as partially allocated)
        for (const member of teamMembers) {
          await employeesCollection.updateOne(
            { name: new ObjectId(member.name) },
            {
              $inc: { availability: -20 }, // Reduce availability by 20%
              $set: { lastTeamAssignment: new Date() }
            }
          );
        }

        return {
          success: true,
          teamId: result.insertedId.toString(),
          message: `Team "${projectTitle}" has been saved to the database with ${teamMembers.length} members.`,
          status: 'proposed'
        };
      } else {
        return {
          success: false,
          error: "Failed to insert team into database"
        };
      }
    } catch (error) {
      console.error("Error saving team to database:", error);
      return {
        success: false,
        error: "An error occurred while saving the team"
      };
    }
  },
});

// Tool 5: Team Recommendation (structured output)
export const generateTeamRecommendation = tool({
  description: 'Generates a final team recommendation with justification.',
  parameters: z.object({
    projectTitle: z.string(),
    projectDescription: z.string(),
    teamMembers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        keySkills: z.array(z.string()),
        justification: z.string()
      })
    ),
    overallRationale: z.string(),
    skillCoverage: z.number().describe('Percentage of required skills covered by the team'),
    risks: z.array(z.string()),
    mitigationStrategies: z.array(z.string())
  }),
  // No execute function - this is our answer tool to provide structured output
});
