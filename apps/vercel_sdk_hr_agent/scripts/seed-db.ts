import { MongoClient, ObjectId } from 'mongodb';
import { Employee, Project, Skill, Team } from '../utils/types.ts';
import { generateEmbeddings } from '../utils/embeddings.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Sample data for employees
const sampleEmployees: Array<Omit<Employee, '_id'>> = [
    {
        name: 'Alex Chen',
        title: 'Senior Frontend Developer',
        department: 'Engineering',
        email: 'alex.chen@example.com',
        hireDate: new Date('2019-06-15'),
        availability: 75,
        skills: [
            {
                name: 'React',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['e-commerce', 'fintech', 'dashboard design']
            },
            {
                name: 'TypeScript',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['web applications', 'frontend architecture']
            },
            {
                name: 'D3.js',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['data visualization', 'financial charts', 'dashboards']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 4,
            lastReviewDate: new Date('2023-01-10')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Frontend Lead',
                contribution: 'Led UI architecture and implemented complex data visualizations'
            }
        ],
        teamHistory: [], // Will be populated based on projects,
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Sam Patel',
        title: 'Backend Developer',
        department: 'Engineering',
        email: 'sam.patel@example.com',
        hireDate: new Date('2020-03-10'),
        availability: 60,
        skills: [
            {
                name: 'MongoDB',
                proficiency: 5,
                yearsExperience: 3,
                contexts: ['financial databases', 'data modeling', 'schema design']
            },
            {
                name: 'Node.js',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['REST APIs', 'microservices', 'serverless']
            },
            {
                name: 'API Design',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['RESTful API', 'GraphQL', 'API security']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 5,
            lastReviewDate: new Date('2023-02-15')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Database Engineer',
                contribution: 'Optimized database queries and implemented efficient data models'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Riley Johnson',
        title: 'Security Engineer',
        department: 'IT Security',
        email: 'riley.johnson@example.com',
        hireDate: new Date('2018-11-05'),
        availability: 40,
        skills: [
            {
                name: 'OAuth 2.0',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['authentication protocols', 'financial applications', 'healthcare']
            },
            {
                name: 'Security Protocols',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['network security', 'compliance', 'penetration testing']
            },
            {
                name: 'Compliance',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['GDPR', 'HIPAA', 'financial regulations']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 3,
            lastReviewDate: new Date('2023-01-05')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Security Lead',
                contribution: 'Implemented OAuth 2.0 authentication and security protocols'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Morgan Lee',
        title: 'UX Designer',
        department: 'Design',
        email: 'morgan.lee@example.com',
        hireDate: new Date('2021-02-20'),
        availability: 80,
        skills: [
            {
                name: 'UI/UX Design',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['financial interfaces', 'healthcare portals', 'mobile apps']
            },
            {
                name: 'Financial Regulations',
                proficiency: 3,
                yearsExperience: 2,
                contexts: ['banking UI', 'compliance', 'disclosure design']
            },
            {
                name: 'User Research',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['qualitative interviews', 'usability testing', 'analytics']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 5,
            lastReviewDate: new Date('2023-03-15')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Lead Designer',
                contribution: 'Created comprehensive design system for financial applications'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Jordan Kim',
        title: 'Full Stack Developer',
        department: 'Engineering',
        email: 'jordan.kim@example.com',
        hireDate: new Date('2020-09-15'),
        availability: 50,
        skills: [
            {
                name: 'JavaScript',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['React', 'Node.js', 'full stack applications']
            },
            {
                name: 'AWS',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['Lambda', 'DynamoDB', 'CloudFormation']
            },
            {
                name: 'CI/CD',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['GitHub Actions', 'Jenkins', 'automated testing']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 4,
            lastReviewDate: new Date('2023-02-01')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Full Stack Developer',
                contribution: 'Built end-to-end features and implemented cloud infrastructure'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Taylor Wong',
        title: 'Data Scientist',
        department: 'Data Analytics',
        email: 'taylor.wong@example.com',
        hireDate: new Date('2019-04-12'),
        availability: 65,
        skills: [
            {
                name: 'Python',
                proficiency: 5,
                yearsExperience: 7,
                contexts: ['data analysis', 'machine learning', 'statistical modeling']
            },
            {
                name: 'SQL',
                proficiency: 4,
                yearsExperience: 6,
                contexts: ['data querying', 'database optimization', 'financial analytics']
            },
            {
                name: 'Machine Learning',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['predictive models', 'classification algorithms', 'recommendation systems']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 4,
            lastReviewDate: new Date('2023-01-20')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Data Analyst',
                contribution: 'Created predictive models for financial risk assessment'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Casey Martinez',
        title: 'DevOps Engineer',
        department: 'Engineering',
        email: 'casey.martinez@example.com',
        hireDate: new Date('2018-07-10'),
        availability: 45,
        skills: [
            {
                name: 'Kubernetes',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['container orchestration', 'microservices deployment', 'service reliability']
            },
            {
                name: 'Docker',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['containerization', 'deployment pipelines', 'CI/CD integration']
            },
            {
                name: 'Cloud Architecture',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['AWS', 'Azure', 'scalable systems']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 4,
            lastReviewDate: new Date('2022-12-05')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'DevOps Lead',
                contribution: 'Designed cloud infrastructure and automated deployment processes'
            }
        ],
        teamHistory: [],
        embedding : [] // Will be populated based on skills
    },
    {
        name: 'Avery Thompson',
        title: 'Project Manager',
        department: 'Management',
        email: 'avery.thompson@example.com',
        hireDate: new Date('2019-02-18'),
        availability: 30,
        skills: [
            {
                name: 'Agile Methodologies',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['software development', 'cross-functional teams', 'sprint planning']
            },
            {
                name: 'Risk Management',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['project planning', 'mitigation strategies', 'stakeholder communication']
            },
            {
                name: 'Resource Allocation',
                proficiency: 5,
                yearsExperience: 7,
                contexts: ['team optimization', 'budget planning', 'timeline management']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 5,
            lastReviewDate: new Date('2023-01-15')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Project Manager',
                contribution: 'Delivered complex projects on time and under budget with high client satisfaction'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Jamie Rodriguez',
        title: 'QA Engineer',
        department: 'Engineering',
        email: 'jamie.rodriguez@example.com',
        hireDate: new Date('2020-05-11'),
        availability: 70,
        skills: [
            {
                name: 'Automated Testing',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['Selenium', 'Cypress', 'test framework development']
            },
            {
                name: 'Test Planning',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['test case design', 'risk assessment', 'coverage analysis']
            },
            {
                name: 'Performance Testing',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['load testing', 'stress testing', 'bottleneck identification']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 4,
            lastReviewDate: new Date('2023-02-10')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Lead QA Engineer',
                contribution: 'Developed automated test framework that reduced testing time by 60%'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Quinn Nguyen',
        title: 'Mobile Developer',
        department: 'Engineering',
        email: 'quinn.nguyen@example.com',
        hireDate: new Date('2021-03-22'),
        availability: 55,
        skills: [
            {
                name: 'React Native',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['cross-platform development', 'mobile UI/UX', 'native modules']
            },
            {
                name: 'Swift',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['iOS development', 'CoreData', 'SwiftUI']
            },
            {
                name: 'Mobile Security',
                proficiency: 3,
                yearsExperience: 2,
                contexts: ['secure storage', 'biometric authentication', 'encrypted communication']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 4,
            lastReviewDate: new Date('2022-11-30')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Mobile Developer',
                contribution: 'Created cross-platform mobile app with shared codebase and native experience'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Dakota Singh',
        title: 'Machine Learning Engineer',
        department: 'Data Analytics',
        email: 'dakota.singh@example.com',
        hireDate: new Date('2020-07-15'),
        availability: 40,
        skills: [
            {
                name: 'TensorFlow',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['neural networks', 'computer vision', 'model optimization']
            },
            {
                name: 'NLP',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['sentiment analysis', 'text classification', 'chatbot development']
            },
            {
                name: 'Data Preprocessing',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['feature engineering', 'data normalization', 'outlier detection']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 3,
            lastReviewDate: new Date('2022-12-15')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'ML Specialist',
                contribution: 'Developed recommendation system that increased user engagement by 35%'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Robin Patel',
        title: 'Product Manager',
        department: 'Product',
        email: 'robin.patel@example.com',
        hireDate: new Date('2019-09-03'),
        availability: 25,
        skills: [
            {
                name: 'Product Strategy',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['market research', 'competitive analysis', 'roadmap planning']
            },
            {
                name: 'User Story Mapping',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['agile planning', 'feature prioritization', 'sprint planning']
            },
            {
                name: 'Analytics',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['KPI tracking', 'A/B testing', 'user behavior analysis']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 5,
            lastReviewDate: new Date('2023-01-05')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Product Manager',
                contribution: 'Led product strategy for flagship service resulting in 40% revenue growth'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Evan Wilson',
        title: 'Cloud Architect',
        department: 'Engineering',
        email: 'evan.wilson@example.com',
        hireDate: new Date('2018-05-07'),
        availability: 35,
        skills: [
            {
                name: 'AWS Solutions',
                proficiency: 5,
                yearsExperience: 7,
                contexts: ['serverless architecture', 'cost optimization', 'disaster recovery']
            },
            {
                name: 'Terraform',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['infrastructure as code', 'multi-cloud deployment', 'environment management']
            },
            {
                name: 'Distributed Systems',
                proficiency: 4,
                yearsExperience: 6,
                contexts: ['scalability patterns', 'microservices', 'high availability']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 4,
            lastReviewDate: new Date('2022-11-20')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Lead Architect',
                contribution: 'Designed cloud migration strategy saving 30% in infrastructure costs'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Harper Garcia',
        title: 'Cybersecurity Analyst',
        department: 'IT Security',
        email: 'harper.garcia@example.com',
        hireDate: new Date('2020-01-20'),
        availability: 60,
        skills: [
            {
                name: 'Threat Detection',
                proficiency: 5,
                yearsExperience: 5,
                contexts: ['intrusion detection systems', 'log analysis', 'security monitoring']
            },
            {
                name: 'Penetration Testing',
                proficiency: 4,
                yearsExperience: 4,
                contexts: ['vulnerability assessment', 'exploit development', 'security reporting']
            },
            {
                name: 'Incident Response',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['threat containment', 'forensic analysis', 'recovery procedures']
            }
        ],
        performance: {
            rating: 5,
            teamworkScore: 3,
            lastReviewDate: new Date('2022-12-10')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Security Analyst',
                contribution: 'Implemented advanced threat detection system that identified 3 zero-day vulnerabilities'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Blake Foster',
        title: 'UI Developer',
        department: 'Design',
        email: 'blake.foster@example.com',
        hireDate: new Date('2021-06-10'),
        availability: 85,
        skills: [
            {
                name: 'CSS/SASS',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['responsive design', 'animation', 'design systems']
            },
            {
                name: 'Accessibility',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['WCAG compliance', 'screen reader optimization', 'keyboard navigation']
            },
            {
                name: 'Design Tools',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['Figma', 'Sketch', 'Adobe XD']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 5,
            lastReviewDate: new Date('2023-02-05')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Frontend UI Developer',
                contribution: 'Built accessible component library used across all company products'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Skyler Ahmed',
        title: 'Database Administrator',
        department: 'Engineering',
        email: 'skyler.ahmed@example.com',
        hireDate: new Date('2019-11-12'),
        availability: 50,
        skills: [
            {
                name: 'PostgreSQL',
                proficiency: 5,
                yearsExperience: 7,
                contexts: ['performance tuning', 'replication', 'high availability clusters']
            },
            {
                name: 'Database Migration',
                proficiency: 4,
                yearsExperience: 5,
                contexts: ['zero-downtime migrations', 'data integrity', 'schema evolution']
            },
            {
                name: 'Data Modeling',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['relational databases', 'NoSQL', 'hybrid approaches']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 4,
            lastReviewDate: new Date('2023-01-25')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Database Architect',
                contribution: 'Redesigned database schema that improved query performance by 200%'
            }
        ],
        teamHistory: [],
        embedding: []
    },
    {
        name: 'Reese Jackson',
        title: 'Technical Writer',
        department: 'Documentation',
        email: 'reese.jackson@example.com',
        hireDate: new Date('2021-01-15'),
        availability: 90,
        skills: [
            {
                name: 'API Documentation',
                proficiency: 5,
                yearsExperience: 4,
                contexts: ['OpenAPI specs', 'developer portals', 'code examples']
            },
            {
                name: 'Technical Communication',
                proficiency: 5,
                yearsExperience: 6,
                contexts: ['user guides', 'knowledge bases', 'release notes']
            },
            {
                name: 'Information Architecture',
                proficiency: 4,
                yearsExperience: 3,
                contexts: ['content organization', 'user flows', 'documentation systems']
            }
        ],
        performance: {
            rating: 4,
            teamworkScore: 5,
            lastReviewDate: new Date('2022-11-05')
        },
        pastProjects: [
            {
                projectId: new ObjectId(),
                role: 'Documentation Lead',
                contribution: 'Created comprehensive API documentation that reduced support tickets by 45%'
            }
        ],
        teamHistory: [],
        embedding: []
    }

];

// Sample projects to establish team history
const sampleProjects: Array<Omit<Project, '_id'>> = [
  {
    title: 'E-commerce Platform Redesign',
    description: 'Redesigned the company\'s e-commerce platform with modern UI and optimized backend',
    startDate: new Date('2022-03-01'),
    endDate: new Date('2022-06-30'),
    teamSize: 4,
    success: 4,
    teamMembers: [] // Will be populated during seeding
  },
  {
    title: 'Financial Analytics Dashboard',
    description: 'Built a comprehensive analytics dashboard for financial data visualization and reporting',
    startDate: new Date('2022-01-15'),
    endDate: new Date('2022-04-20'),
    teamSize: 3,
    success: 5,
    teamMembers: []
  },
  {
    title: 'Security Compliance Upgrade',
    description: 'Updated security protocols and implemented OAuth 2.0 across all company applications',
    startDate: new Date('2021-09-10'),
    endDate: new Date('2022-01-05'),
    teamSize: 3,
    success: 4,
    teamMembers: []
  }
];

// Function to generate embeddings for skills
async function generateSkillEmbeddings(employees: Array<Omit<Employee, '_id'>>) {
  for (const employee of employees) {
    try {
      // Create combined skill description using | as separator
      const skillDescriptions = employee.skills.map(skill =>
        `${skill.name}: ${skill.proficiency}/5 proficiency with ${skill.yearsExperience} years experience in contexts like ${skill.contexts.join(', ')}`
      );

      const combinedSkillDescription = skillDescriptions.join(' | ');

      // Generate embedding for all skills combined
      const embeddingResults = await generateEmbeddings(combinedSkillDescription);

      // Add the embedding to the employee document at the top level
      if (embeddingResults.length > 0) {
        (employee as any).embedding = embeddingResults[0].embedding;
        console.log(`✅ Generated top-level embedding for ${employee.name}'s combined skills`);
      } else {
        console.warn(`⚠️ No embeddings generated for ${employee.name}'s combined skills`);
        (employee as any).embedding = [];
      }
    } catch (error) {
      console.error(`❌ Error generating embedding for ${employee.name}'s skills:`, error);
      // Set an empty embedding as fallback
      (employee as any).embedding = [];
    }
  }

  return employees;
}

// Main seeding function
async function seedDatabase() {
  // Fixed: Assert MONGODB_URI is not undefined
  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('hr_database');
    const employeesCollection = db.collection('employees');
    const projectsCollection = db.collection('projects');
    const teamsCollection = db.collection('teams');

    // Clear existing data
    await employeesCollection.deleteMany({});
    await projectsCollection.deleteMany({});
    await teamsCollection.deleteMany({});

    console.log('Existing data cleared. Generating embeddings for employee skills...');

    // Generate embeddings for all employee skills
    const employeesWithEmbeddings = await generateSkillEmbeddings(sampleEmployees);

    console.log('Inserting employees...');
    const insertedEmployees = await employeesCollection.insertMany(employeesWithEmbeddings);
    console.log(`${Object.keys(insertedEmployees.insertedIds).length} employees inserted`);

    // Map employee names to their inserted ObjectIds for reference
    const employeeIdMap = new Map();
    Object.entries(insertedEmployees.insertedIds).forEach(([index, id]) => {
      employeeIdMap.set(employeesWithEmbeddings[parseInt(index)].name, id);
    });

    // Update projects with team members
    const projectsToInsert = sampleProjects.map(project => {
      const teamMembers: ObjectId[] = [];

      // Assign team members based on projects
      if (project.title === 'E-commerce Platform Redesign') {
        teamMembers.push(
          employeeIdMap.get('Alex Chen'),
          employeeIdMap.get('Sam Patel'),
          employeeIdMap.get('Morgan Lee'),
          employeeIdMap.get('Jordan Kim')
        );
      } else if (project.title === 'Financial Analytics Dashboard') {
        teamMembers.push(
          employeeIdMap.get('Alex Chen'),
          employeeIdMap.get('Taylor Wong'),
          employeeIdMap.get('Morgan Lee')
        );
      } else if (project.title === 'Security Compliance Upgrade') {
        teamMembers.push(
          employeeIdMap.get('Riley Johnson'),
          employeeIdMap.get('Sam Patel'),
          employeeIdMap.get('Casey Martinez')
        );
      }

      return {
        ...project,
        teamMembers
      };
    });

    // Insert projects
    console.log('Inserting projects...');
    const insertedProjects = await projectsCollection.insertMany(projectsToInsert);
    console.log(`${Object.keys(insertedProjects.insertedIds).length} projects inserted`);

    // Map project titles to their inserted ObjectIds
    const projectIdMap = new Map();
    Object.entries(insertedProjects.insertedIds).forEach(([index, id]) => {
      projectIdMap.set(projectsToInsert[parseInt(index)].title, id);
    });

    // Update employee teamHistory based on projects
    // Fixed: Use proper type for bulkWrite operations
    const teamHistoryUpdates = [];

    for (const project of projectsToInsert) {
      const memberIds = project.teamMembers;

      // For each team member, add all other team members to their teamHistory
      for (const memberId of memberIds) {
        const otherMemberIds = memberIds.filter(id => !id.equals(memberId));
        if (otherMemberIds.length > 0) {
          teamHistoryUpdates.push({
            updateOne: {
              filter: { _id: memberId },
              update: { $push: { teamHistory: { $each: otherMemberIds } } }
            }
          });
        }
      }
    }

    if (teamHistoryUpdates.length > 0) {
      console.log('Updating team history...');
      // Fixed: Cast to any to avoid type issues with bulkWrite
      await employeesCollection.bulkWrite(teamHistoryUpdates as any);
      console.log(`Updated team history for employees`);
    }

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the seeding function
seedDatabase()
  .catch(console.error)
  .finally(() => process.exit(0));
