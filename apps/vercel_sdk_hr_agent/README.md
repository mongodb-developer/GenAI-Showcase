# HR Team Matcher

A smart HR assistant that helps managers build optimal teams for projects using MongoDB Vector Search for semantic skills matching and the Vercel AI SDK for agentic capabilities.

## Features

- **Advanced Skill Matching**: Uses MongoDB Vector Search to find employees with the right skills, even when they're not an exact keyword match
- **Multi-step Reasoning**: Uses Vercel AI SDK's agentic functionality to analyze projects, search for candidates, and evaluate team fit
- **Team Analysis**: Evaluates skill coverage, team diversity, and past collaboration success
- **Recommendations with Rationale**: Provides detailed justification for each team member suggestion
- **Risk Assessment**: Identifies potential issues with proposed teams and suggests mitigation strategies

## Architecture

The HR Team Matcher is built with the following technologies:

- **Next.js**: Frontend and API routes
- **MongoDB**: Database with Vector Search for semantic skill matching
- **Vercel AI SDK**: Agentic AI capabilities with multi-step reasoning
- **Voyage AI**: Generation of text embeddings for semantic search
- **OpenAI**: Language model for team analysis and recommendations
- **Tailwind CSS**: Styling

## How It Works

1. **Project Analysis**: The agent analyzes the project description to extract required skills, team size, and timeline constraints
2. **Skill Matching**: Using MongoDB Vector Search, the system finds employees with matching skills
3. **Team Formation**: The agent explores different combinations to form an optimal team
4. **Team Evaluation**: Each potential team is evaluated for skill coverage, diversity, and collaboration history
5. **Recommendation**: The best team is recommended with detailed justifications and risk assessments

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- MongoDB Atlas account (with Vector Search capability)
- OpenAI API key
- Voyage AI API key

### Environment Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env.local` file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   VOYAGE_API_KEY=your_voyage_api_key
   ```

### Database Setup

1. Create a MongoDB Atlas cluster
2. Create a database named `hr_database`
3. Create the following collections:
   - `employees`
   - `teams`
4. Set up the Vector Search index on the `employees` collection named `skill_vector_index`:
   ```json
   {
        "fields": [
        {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1024,
        "similarity": "cosine"
        }
    ]
    }
   ```

### Running the Application

1. Start the development server:
   ```
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Navigate to the "Build New Team" tab
2. Enter a detailed project description, including required skills, timeline, and any special requirements
3. Click "Build Team" and wait for the AI to generate a team recommendation
4. Review the recommended team, including skill coverage, member details, and risk assessment
5. Saved teams can be viewed and approved in the "Team History" tab

## Implementation Details

### MongoDB Vector Search

Skills are matched using semantic search, allowing the system to understand that "React experience" is related to "Frontend development" even without exact keyword matches.

### Voyage AI Embeddings

The Voyage AI model converts skill descriptions into vector embeddings that capture semantic meaning, enabling more intelligent matching.

### Vercel AI SDK Agent

The agent uses multiple tools in sequence to:
1. Analyze projects with `analyzeProjectRequirements`
2. Search for employees with `searchEmployeesBySkill`
3. Analyze team compositions with `analyzeTeamComposition`
4. Save recommended teams with `saveTeamToDatabase`
5. Generate final recommendations with `generateTeamRecommendation`

The `maxSteps: 15` parameter enables the agent to perform multiple tool calls in sequence, making it a true agentic application rather than a simple API wrapper.

## License

MIT
