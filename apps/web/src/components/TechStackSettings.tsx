import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Code2, Database, Layers, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { TechStackTemplate } from '../types';

interface TechStackSettingsProps {
  collectionId: string;
}

const CATEGORY_ICONS: Record<string, typeof Code2> = {
  frontend: Layers,
  backend: Code2,
  database: Database,
  mobile: Sparkles,
};

const CATEGORY_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  mobile: 'Mobile',
  devops: 'DevOps',
  testing: 'Testing',
  other: 'Other',
};

export function TechStackSettings({ collectionId }: TechStackSettingsProps) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch current profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['tech-profile', collectionId],
    queryFn: () => apiClient.getTechStackProfile(collectionId),
    retry: false,
  });

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['tech-templates'],
    queryFn: () => apiClient.getTechStackTemplates(),
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: (templateName: string) =>
      apiClient.applyTechStackTemplate(collectionId, templateName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tech-profile', collectionId] });
      setSelectedTemplate(null);
    },
  });

  const profile = profileData?.profile;
  const templates = templatesData?.templates || [];

  // Group templates by category
  const templatesByCategory = templates.reduce<Record<string, TechStackTemplate[]>>(
    (acc, template) => {
      const category = template.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(template);
      return acc;
    },
    {}
  );

  if (profileLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center py-lg">
        <Loader2 className="animate-spin text-accent" size={24} />
        <span className="ml-sm text-text-secondary">Loading tech stack settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* Current Profile */}
      {profile && (
        <div className="card">
          <h3 className="font-semibold text-text-primary mb-md flex items-center gap-sm">
            <Check className="text-success" size={18} />
            Current Tech Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            {profile.primary_language && (
              <div>
                <span className="text-xs text-text-secondary block">Language</span>
                <span className="font-medium">{profile.primary_language}</span>
              </div>
            )}
            {profile.primary_framework && (
              <div>
                <span className="text-xs text-text-secondary block">Framework</span>
                <span className="font-medium">{profile.primary_framework}</span>
              </div>
            )}
            {profile.database_type && (
              <div>
                <span className="text-xs text-text-secondary block">Database</span>
                <span className="font-medium">{profile.database_type}</span>
              </div>
            )}
            {profile.frameworks.length > 0 && (
              <div>
                <span className="text-xs text-text-secondary block">Libraries</span>
                <span className="font-medium">{profile.frameworks.length} configured</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Selection */}
      <div>
        <h3 className="font-semibold text-text-primary mb-md">
          {profile ? 'Change Tech Stack' : 'Select Tech Stack Template'}
        </h3>
        <p className="text-sm text-text-secondary mb-md">
          Choose a template to optimize search and retrieval for your tech stack.
        </p>

        <div className="space-y-lg">
          {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => {
            const Icon = CATEGORY_ICONS[category] || Code2;
            return (
              <div key={category}>
                <h4 className="text-sm font-medium text-text-secondary mb-sm flex items-center gap-xs">
                  <Icon size={14} />
                  {CATEGORY_LABELS[category] || category}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-sm">
                  {categoryTemplates.map((template) => {
                    const isSelected = selectedTemplate === template.name;
                    const isCurrent =
                      profile?.primary_framework === template.primary_framework &&
                      profile?.primary_language === template.primary_language;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplate(isSelected ? null : template.name)}
                        className={`p-md rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/5'
                            : isCurrent
                              ? 'border-success bg-success/5'
                              : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-medium text-text-primary block">
                              {template.name}
                            </span>
                            {template.description && (
                              <span className="text-xs text-text-secondary block mt-xs">
                                {template.description}
                              </span>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-xs mt-sm">
                          {template.primary_language && (
                            <span className="text-xs bg-bg-secondary px-2 py-0.5 rounded">
                              {template.primary_language}
                            </span>
                          )}
                          {template.primary_framework && (
                            <span className="text-xs bg-bg-secondary px-2 py-0.5 rounded">
                              {template.primary_framework}
                            </span>
                          )}
                          {template.database_type && (
                            <span className="text-xs bg-bg-secondary px-2 py-0.5 rounded">
                              {template.database_type}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply Button */}
        {selectedTemplate && (
          <div className="mt-lg flex items-center gap-md">
            <button
              type="button"
              onClick={() => applyTemplateMutation.mutate(selectedTemplate)}
              disabled={applyTemplateMutation.isPending}
              className="btn btn-primary flex items-center gap-xs"
            >
              {applyTemplateMutation.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Apply "{selectedTemplate}" Template
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplate(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}

        {applyTemplateMutation.isError && (
          <div className="mt-md text-sm text-error bg-red-50 p-3 rounded-md">
            Failed to apply template. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
