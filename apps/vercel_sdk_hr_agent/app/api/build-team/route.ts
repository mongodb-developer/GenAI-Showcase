import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import {
  analyzeProjectRequirements,
  searchEmployeesBySkill,
  analyzeTeamComposition,
  saveTeamToDatabase,
  generateTeamRecommendation
} from '../../../utils/tools';

export async function POST(req: NextRequest) {
  try {
    const { projectDescription } = await req.json();

    if (!projectDescription) {
      return NextResponse.json({ error: 'Project description is required' }, { status: 400 });
    }

    const result = await buildTeam(projectDescription);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error building team:', error);
    return NextResponse.json({ error: 'Failed to build team' }, { status: 500 });
  }
}

async function buildTeam(projectDescription: string) {
  const { steps ,  toolCalls } = await generateText({
    model: openai('o3-mini', { structuredOutputs: true }),
    tools: {
      analyzeProjectRequirements,
      searchEmployeesBySkill,
      analyzeTeamComposition,
      saveTeamToDatabase,
      generateTeamRecommendation,
    },
    toolChoice: 'auto', // Force structured output using the generateTeamRecommendation tool
    maxSteps: 15, // This is the key to enabling agentic behavior!
    system: `You are an expert HR assistant that builds optimal teams for projects.
      Given a project description follow this set of steps:
      1. Analyze the requirements to identify needed skills (analyzeProjectRequirements)
      2. Search for employees with matching skills (searchEmployeesBySkill)
      3. Evaluate possible team compositions (analyzeTeamComposition)
      4. MUST Save the recommended team to the database (saveTeamToDatabase)
      5. Generate a final recommendation with justification (generateTeamRecommendation)

      Consider skill coverage, team diversity, availability, and past collaboration success.
      Be thorough in your analysis but aim to build the smallest effective team possible. If unable to complete a team, please provide a reason why but do place people with potential.

      After your final recommendation is complete, save the team to the database for record-keeping.`,
    prompt: projectDescription,
  });

  // Find the last generateTeamRecommendation call for the final recommendation
  const recommendationCall = toolCalls.find(
    call => call.toolName === 'generateTeamRecommendation'
  );

  // Find the database save call to get the team ID
  const databaseCall = toolCalls.find(
    call => call.toolName === 'saveTeamToDatabase'
  );

  // Combine the recommendation with the database result
  if (recommendationCall && databaseCall) {
    return {
      recommendation: recommendationCall.args,
      databaseResult: databaseCall.args
    };
  }

  // Fallback to just the recommendation if database save failed
  if (recommendationCall) {
    return { recommendation: recommendationCall.args };
  }

  return { error: "Failed to generate team recommendation" };
}
