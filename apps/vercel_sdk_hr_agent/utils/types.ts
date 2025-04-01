import { ObjectId } from 'mongodb';

export interface Skill {
  name: string;
  proficiency: number; // 1-5 scale
  yearsExperience: number;
  contexts: string[]; // e.g., ["financial applications", "healthcare", "e-commerce"]
}

export interface Project {
  _id?: ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  teamSize: number;
  success: number; // 1-5 scale
  teamMembers: ObjectId[];
}

export interface Employee {
  _id?: ObjectId;
  name: string;
  title: string;
  department: string;
  email: string;
  hireDate: Date;
  availability: number; // percentage available for new projects
  skills: Skill[];
  performance: {
    rating: number; // 1-5 scale
    teamworkScore: number; // 1-5 scale
    lastReviewDate: Date;
  };
  pastProjects: {
    projectId: ObjectId;
    role: string;
    contribution: string;
  }[];
  teamHistory: ObjectId[]; // IDs of employees they've worked with
  embedding: number[]; // Combined skills embedding at the top level
}

export interface Team {
  _id?: ObjectId;
  projectTitle: string;
  projectDescription: string;
  createdAt: Date;
  members: {
    name: string;
    role: string;
    keySkills: string[];
    justification: string;
  }[];
  skillCoverage: number;
  overallRationale: string;
  risks: string[];
  mitigationStrategies: string[];
  status: 'proposed' | 'approved' | 'active' | 'completed';
}
