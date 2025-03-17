'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TeamMember from './components/TeamMember';
import Loading from './components/Loading';

export default function Home() {
  const [projectDescription, setProjectDescription] = useState('');
  const [recommendation, setRecommendation] = useState<any>(null);
  const [savedTeams, setSavedTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('build'); // 'build' or 'history'

  // Load saved teams on component mount
  useEffect(() => {
    async function loadSavedTeams() {
      try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        setSavedTeams(data.teams);
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    }

    loadSavedTeams();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRecommendation(null);

    try {
      const response = await fetch('/api/build-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDescription })
      });

      const data = await response.json();
      setRecommendation(data.recommendation);

      // Refresh saved teams list
      if (data.databaseResult?.success) {
        const teamsResponse = await fetch('/api/teams');
        const teamsData = await teamsResponse.json();
        setSavedTeams(teamsData.teams);
      }
    } catch (error) {
      console.error('Error building team:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveTeam(teamId: string) {
    try {
      await fetch(`/api/teams/${teamId}/approve`, {
        method: 'POST'
      });

      // Refresh team list
      const response = await fetch('/api/teams');
      const data = await response.json();
      setSavedTeams(data.teams);
    } catch (error) {
      console.error('Error approving team:', error);
    }
  }

  return (
    <main className="container mx-auto p-4 max-w-6xl">
      <header className="bg-blue-600 py-4 px-6 rounded-lg shadow-md mb-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">HR Team Builder</h1>
            <p className="text-white/80">Powered by MongoDB Vector Search (with VoyageAI) and Vercel AI SDK</p>
          </div>
        </div>
      </header>

      <div className="mb-6 flex border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'build' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('build')}
        >
          Build New Team
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Team History
        </button>
      </div>

      {activeTab === 'build' ? (
        <div>
          <form onSubmit={handleSubmit} className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <label className="block mb-2 font-semibold">Project Description:</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                rows={6}
                placeholder="Describe the project, required skills, timeline, and any special requirements..."
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Example: "We need to build a wealth management dashboard using React, with MongoDB backend and OAuth 2.0 security. The project has high visibility to executives and needs to be completed within 2 months."
              </p>
            </div>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Build Team'}
            </button>
          </form>

          {/* Loading state */}
          {loading && <Loading />}

          {/* Team recommendation display */}
          {!loading && recommendation && (
            <div className="border rounded-lg shadow-md p-6 bg-white">
              <div className="border-b pb-4 mb-4">
                <h2 className="text-2xl font-bold">{recommendation.projectTitle}</h2>
                <p className="text-gray-600 mt-1">{recommendation.projectDescription}</p>
              </div>

              <div className="flex items-center mb-4">
                <div className="w-32 mr-6">
                  <div className="text-xs text-gray-500 uppercase">Skill Coverage</div>
                  <div className="text-2xl font-bold text-blue-600">{recommendation.skillCoverage}%</div>
                </div>

                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full"
                      style={{ width: `${recommendation.skillCoverage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg mb-4">Recommended Team</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {recommendation.teamMembers.map((member: any) => (
                  <TeamMember
                    key={member.id}
                    name={member.name}
                    role={member.role}
                    keySkills={member.keySkills}
                    justification={member.justification}
                  />
                ))}
              </div>

              {/* Rationale */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3 className="font-bold mb-2">Team Rationale</h3>
                <p className="text-gray-700">{recommendation.overallRationale}</p>
              </div>

              {/* Risks and Mitigations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2 text-orange-800">Potential Risks</h3>
                  <ul className="list-disc pl-5 text-gray-700">
                    {recommendation.risks?.map((risk: string, index: number) => (
                      <li key={index}>{risk}</li>
                    )) || <li>No risks identified</li>}
                  </ul>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2 text-green-800">Mitigation Strategies</h3>
                  <ul className="list-disc pl-5 text-gray-700">
                    {recommendation.mitigationStrategies?.map((strategy: string, index: number) => (
                      <li key={index}>{strategy}</li>
                    )) || <li>No mitigation strategies needed</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold mb-4">Saved Teams</h2>

          {/* Team history display */}
          {savedTeams.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              <p>No teams have been saved yet.</p>
              <p className="mt-2">Build your first team to see it here!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedTeams.map((team) => (
                <div key={team._id?.toString()} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">{team.projectTitle}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      team.status === 'approved' ? 'bg-green-100 text-green-800' :
                      team.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      team.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-4 text-sm line-clamp-2">{team.projectDescription}</p>

                  <div className="flex flex-wrap gap-4 text-sm mb-3">
                    <div>
                      <span className="font-semibold">Created:</span> {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-semibold">Team Size:</span> {team.members.length} members
                    </div>
                    <div>
                      <span className="font-semibold">Skill Coverage:</span> {team.skillCoverage}%
                    </div>
                  </div>

                  {/* Team members summary */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {team.members.map((member: any) => (
                      <div key={member.employeeId} className="bg-gray-100 rounded px-3 py-1 text-sm">
                        {member.name} ({member.role})
                      </div>
                    ))}
                  </div>

                  {team.status === 'proposed' && (
                    <button
                      onClick={() => handleApproveTeam(team._id)}
                      className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
                    >
                      Approve Team
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>HR Team Builder Demo - Built with MongoDB Vector Search and Vercel AI SDK</p>
      </footer>
    </main>
  );
}
