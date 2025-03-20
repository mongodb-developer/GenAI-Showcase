import React from 'react';

interface TeamMemberProps {
  name: string;
  role: string;
  keySkills: string[];
  justification: string;
}

export const TeamMember: React.FC<TeamMemberProps> = ({
  name,
  role,
  keySkills,
  justification
}) => {
  return (
    <div className="border p-4 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
      <div className="flex items-center mb-3">
        <div className="bg-blue-100 rounded-full h-10 w-10 flex items-center justify-center text-blue-500 font-bold mr-3">
          {name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <div className="font-bold">{name}</div>
          <div className="text-sm text-gray-600">{role}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-semibold mb-1">Key Skills:</div>
        <div className="flex flex-wrap gap-1">
          {keySkills.map((skill, i) => (
            <span
              key={i}
              className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-semibold mb-1">Why this person?</div>
        <p className="text-sm text-gray-700">{justification}</p>
      </div>
    </div>
  );
};

export default TeamMember;
