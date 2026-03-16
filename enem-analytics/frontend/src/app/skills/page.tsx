'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AlertTriangle, BookOpen, Brain, Calculator, Lightbulb } from 'lucide-react';

const AREA_CONFIG = {
  CN: {
    name: 'Ciências da Natureza',
    color: '#22c55e',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    icon: Lightbulb,
  },
  CH: {
    name: 'Ciências Humanas',
    color: '#8b5cf6',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    icon: BookOpen,
  },
  LC: {
    name: 'Linguagens e Códigos',
    color: '#ec4899',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
    icon: Brain,
  },
  MT: {
    name: 'Matemática',
    color: '#f97316',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    icon: Calculator,
  },
};

type AreaKey = keyof typeof AREA_CONFIG;

export default function SkillsPage() {
  const [selectedArea, setSelectedArea] = useState<AreaKey | null>(null);

  const { data: skillsData, isLoading } = useQuery({
    queryKey: ['worstSkills'],
    queryFn: () => api.getWorstSkills(undefined, 10),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const areas = Object.keys(AREA_CONFIG) as AreaKey[];
  const displayAreas = selectedArea ? [selectedArea] : areas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Habilidades Mais Difíceis</h1>
        <p className="text-gray-600 mt-1">
          Top 10 habilidades com menor desempenho por área no último ENEM disponível
        </p>
      </div>

      {/* Area Filters */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedArea(null)}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            selectedArea === null
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Todas as Áreas
        </button>
        {areas.map((area) => {
          const config = AREA_CONFIG[area];
          const Icon = config.icon;
          return (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                selectedArea === area
                  ? `${config.bgColor} ${config.textColor} shadow-md ring-2`
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              style={selectedArea === area ? { '--tw-ring-color': config.color } as React.CSSProperties : {}}
            >
              <Icon className="h-4 w-4" />
              {area}
            </button>
          );
        })}
      </div>

      {/* Skills Grid */}
      <div className={`grid gap-6 ${selectedArea ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {displayAreas.map((area) => {
          const config = AREA_CONFIG[area];
          const Icon = config.icon;
          const skills = skillsData?.skills_by_area[area] || [];

          return (
            <div
              key={area}
              className={`bg-white rounded-2xl shadow-sm border ${config.borderColor} overflow-hidden`}
            >
              {/* Area Header */}
              <div className={`${config.bgColor} px-5 py-4 border-b ${config.borderColor}`}>
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: config.color + '20' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${config.textColor}`}>{config.name}</h2>
                    <p className="text-sm text-gray-500">10 habilidades mais difíceis</p>
                  </div>
                </div>
              </div>

              {/* Skills List */}
              <div className="divide-y divide-gray-50">
                {skills.map((skill, index) => (
                  <div
                    key={skill.skill_num}
                    className="px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank Badge */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index < 3
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>

                      {/* Skill Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}
                          >
                            H{skill.skill_num.toString().padStart(2, '0')}
                          </span>
                          {index < 3 && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Crítica
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{skill.descricao}</p>
                      </div>

                      {/* Performance */}
                      <div className="flex-shrink-0 text-right">
                        <div
                          className={`text-lg font-bold ${
                            skill.performance < 25
                              ? 'text-red-600'
                              : skill.performance < 35
                              ? 'text-orange-600'
                              : 'text-yellow-600'
                          }`}
                        >
                          {skill.performance.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">acertos</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 ml-12">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${skill.performance}%`,
                            backgroundColor:
                              skill.performance < 25
                                ? '#dc2626'
                                : skill.performance < 35
                                ? '#ea580c'
                                : '#ca8a04',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Legenda</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Crítico (&lt;25% acertos)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-gray-600">Baixo (25-35% acertos)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Moderado (35-50% acertos)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
