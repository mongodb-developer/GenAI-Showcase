import { z } from 'zod';
import { embed, tool } from 'ai';
import { Document } from 'mongodb';
import { generateEmbeddings } from './embeddings';
import { getCollections } from './db';

// Base type for employee data
interface BaseEmployee {
  name: string;
  skills: string[];
  experience: number;
  availability: number;
  roles: string[];
  specializations: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// MongoDB document type
export type Employee = BaseEmployee & Document;

// MongoDB skill embedding type
type BaseSkillEmbedding = {
  employeeId: string;
  skill: string;
  embedding: number[];
  createdAt: Date;
};

type SkillEmbedding = BaseSkillEmbedding & Document;

// Zod schema for validation
export const EmployeeSchema = z.object({
  name: z.string(),
  skills: z.array(z.string()),
  experience: z.number(),
  availability: z.number().min(0).max(100),
  roles: z.array(z.string()),
  specializations: z.array(z.string()),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

// Define SaveEmployeeInput schema properly
const SaveEmployeeInputSchema = z.object({
  employee: EmployeeSchema
});

type GenerateEmployeeInput = BaseEmployee;
type SaveEmployeeInput = { employee: BaseEmployee };

async function generateSkillEmbeddings(skills: string[]): Promise<Array<{ content: string; embedding: number[] }>> {
  const skillsText = skills.join('\n');
  return await generateEmbeddings(skillsText);
}

export const generateEmployeeProfile = tool<GenerateEmployeeInput, BaseEmployee>("Create employee profile from LLM-provided data",
  EmployeeSchema,
  async (input: GenerateEmployeeInput): Promise<BaseEmployee> => {
    return {
      name: input.name,
      skills: input.skills,
      experience: input.experience,
      availability: input.availability,
      roles: input.roles,
      specializations: input.specializations
    };
});

export const saveEmployeeToDatabase = tool<SaveEmployeeInput, { id: string }>(
  "Save employee profile with skill embeddings to database",
  SaveEmployeeInputSchema,
  async (input: SaveEmployeeInput): Promise<{ id: string }> => {
    const { employees } = await getCollections();

    // Create employee document with timestamps
    const employeeToInsert = {
      name: input.employee.name,
      title: input.employee.title || "",
      department: input.employee.department || "",
      email: input.employee.email || "",
      hireDate: input.employee.hireDate || new Date(),
      availability: input.employee.availability,
      skills: input.employee.skills || [],
      performance: input.employee.performance || {
          rating: 0,
          teamworkScore: 0,
          lastReviewDate: new Date()
      },
      pastProjects: input.employee.pastProjects || [],
      teamHistory: input.employee.teamHistory || [],
      lastTeamAssignment: input.employee.lastTeamAssignment || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding: generateSkillEmbeddings(input.employee.skills)
    };

    // Insert the employee document
    const result = await employees.insertOne(employeeToInsert);

    return { id: result.insertedId.toString() };
});
